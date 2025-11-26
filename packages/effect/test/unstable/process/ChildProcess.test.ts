import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, Layer } from "effect"
import { ChildProcess } from "effect/unstable/process"

// Mock executor for testing
const ExecutorTypeId = "~effect/process/ChildProcessExecutor"

const makeMockExecutor = (): ChildProcess.ChildProcessExecutor => ({
  [ExecutorTypeId]: ExecutorTypeId,
  execute: (_process: ChildProcess.ChildProcess) =>
    Effect.sync(() => {
      const startTime = Date.now()
      const command = `${_process.command} ${_process.args.join(" ")}`

      // Simulate simple execution
      return {
        command,
        exitCode: 0,
        signal: undefined,
        stdout: new TextEncoder().encode("mock stdout"),
        stderr: new TextEncoder().encode("mock stderr"),
        all: undefined,
        duration: Duration.millis(Date.now() - startTime)
      }
    }),
  spawn: (_process: ChildProcess.ChildProcess) =>
    Effect.sync(() => ({
      pid: 12345,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      all: undefined,
      exitCode: Effect.succeed({ exitCode: 0, signal: undefined }),
      kill: (_signal?: string) => Effect.void
    }))
})

const MockExecutorLayer = Layer.succeed(ChildProcess.ChildProcessExecutor, makeMockExecutor())

describe("ChildProcess", () => {
  describe("guards", () => {
    it("isChildProcess should identify ChildProcess instances", () => {
      const proc = ChildProcess.make("node", ["--version"])
      assert.isTrue(ChildProcess.isChildProcess(proc))
      assert.isFalse(ChildProcess.isChildProcess({}))
      assert.isFalse(ChildProcess.isChildProcess(null))
      assert.isFalse(ChildProcess.isChildProcess(undefined))
    })
  })

  describe("constructors", () => {
    it("make should create a process with command and args", () => {
      const proc = ChildProcess.make("node", ["--version"])
      assert.strictEqual(proc.command, "node")
      assert.deepStrictEqual(proc.args, ["--version"])
      assert.deepStrictEqual(proc.options, {})
    })

    it("make should create a process with empty args by default", () => {
      const proc = ChildProcess.make("node")
      assert.strictEqual(proc.command, "node")
      assert.deepStrictEqual(proc.args, [])
      assert.deepStrictEqual(proc.options, {})
    })

    it("shell should create a shell process", () => {
      const proc = ChildProcess.shell("npm run build")
      assert.strictEqual(proc.command, "npm run build")
      assert.deepStrictEqual(proc.args, [])
      assert.strictEqual(proc.options.shell, true)
    })
  })

  describe("configuration", () => {
    it("withCwd should set working directory", () => {
      const proc = ChildProcess.make("node", ["--version"]).pipe(
        ChildProcess.withCwd("/tmp")
      )
      assert.strictEqual(proc.options.cwd, "/tmp")
    })

    it("withEnv should set environment variables", () => {
      const env = { NODE_ENV: "production", DEBUG: "true" }
      const proc = ChildProcess.make("node", ["app.js"]).pipe(
        ChildProcess.withEnv(env)
      )
      assert.deepStrictEqual(proc.options.env, env)
    })

    it("withTimeout should set timeout duration", () => {
      const proc = ChildProcess.make("node", ["script.js"]).pipe(
        ChildProcess.withTimeout("5 seconds")
      )
      assert.deepStrictEqual(proc.options.timeout, Duration.seconds(5))
    })

    it("withStdin should configure stdin", () => {
      const proc = ChildProcess.make("cat").pipe(
        ChildProcess.withStdin("pipe")
      )
      assert.strictEqual(proc.options.stdio?.stdin, "pipe")
    })

    it("withStdout should configure stdout", () => {
      const proc = ChildProcess.make("echo", ["hello"]).pipe(
        ChildProcess.withStdout("inherit")
      )
      assert.strictEqual(proc.options.stdio?.stdout, "inherit")
    })

    it("withStderr should configure stderr", () => {
      const proc = ChildProcess.make("node", ["app.js"]).pipe(
        ChildProcess.withStderr("ignore")
      )
      assert.strictEqual(proc.options.stdio?.stderr, "ignore")
    })

    it("withAll should enable interleaved output", () => {
      const proc = ChildProcess.make("node", ["app.js"]).pipe(
        ChildProcess.withAll(true)
      )
      assert.strictEqual(proc.options.stdio?.all, true)
    })

    it("configuration should be composable", () => {
      const proc = ChildProcess.make("node", ["app.js"]).pipe(
        ChildProcess.withCwd("/app"),
        ChildProcess.withEnv({ NODE_ENV: "test" }),
        ChildProcess.withTimeout("10 seconds"),
        ChildProcess.withStdout("pipe")
      )

      assert.strictEqual(proc.command, "node")
      assert.deepStrictEqual(proc.args, ["app.js"])
      assert.strictEqual(proc.options.cwd, "/app")
      assert.deepStrictEqual(proc.options.env, { NODE_ENV: "test" })
      assert.deepStrictEqual(proc.options.timeout, Duration.seconds(10))
      assert.strictEqual(proc.options.stdio?.stdout, "pipe")
    })
  })

  describe("execution", () => {
    it.effect("execute should run a process and collect output", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("node", ["--version"])
        const result = yield* ChildProcess.execute(proc)

        assert.strictEqual(result.command, "node --version")
        assert.strictEqual(result.exitCode, 0)
        assert.strictEqual(result.signal, undefined)
        assert.isTrue(result.stdout instanceof Uint8Array)
        assert.isTrue(result.stderr instanceof Uint8Array)
      }).pipe(Effect.provide(MockExecutorLayer)))

    it.effect("spawn should return a handle to a running process", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("npm", ["run", "build"])
        const handle = yield* ChildProcess.spawn(proc)

        assert.strictEqual(handle.pid, 12345)
        assert.isTrue(Effect.isEffect(handle.exitCode))
        assert.isTrue(typeof handle.kill === "function")
      }).pipe(Effect.provide(MockExecutorLayer)))

    it.effect("execute should work with configured process", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("node", ["app.js"]).pipe(
          ChildProcess.withCwd("/tmp"),
          ChildProcess.withEnv({ NODE_ENV: "test" }),
          ChildProcess.withTimeout("5 seconds")
        )

        const result = yield* ChildProcess.execute(proc)

        assert.strictEqual(result.exitCode, 0)
        assert.isTrue(result.stdout instanceof Uint8Array)
      }).pipe(Effect.provide(MockExecutorLayer)))
  })

  describe("error types", () => {
    it("SpawnError should be constructable", () => {
      const error = new ChildProcess.SpawnError({
        command: "node",
        cause: new Error("ENOENT")
      })
      assert.strictEqual(error._tag, "SpawnError")
      assert.strictEqual(error.command, "node")
    })

    it("ExitCodeError should be constructable", () => {
      const error = new ChildProcess.ExitCodeError({
        command: "npm test",
        exitCode: 1,
        stdout: new Uint8Array(),
        stderr: new Uint8Array()
      })
      assert.strictEqual(error._tag, "ExitCodeError")
      assert.strictEqual(error.command, "npm test")
      assert.strictEqual(error.exitCode, 1)
    })

    it("SignalError should be constructable", () => {
      const error = new ChildProcess.SignalError({
        command: "node app.js",
        signal: "SIGTERM"
      })
      assert.strictEqual(error._tag, "SignalError")
      assert.strictEqual(error.signal, "SIGTERM")
    })

    it("TimeoutError should be constructable", () => {
      const error = new ChildProcess.TimeoutError({
        command: "node app.js",
        timeout: Duration.seconds(5)
      })
      assert.strictEqual(error._tag, "TimeoutError")
      assert.deepStrictEqual(error.timeout, Duration.seconds(5))
    })

    it("MaxBufferError should be constructable", () => {
      const error = new ChildProcess.MaxBufferError({
        command: "cat large.txt",
        maxBuffer: 1024
      })
      assert.strictEqual(error._tag, "MaxBufferError")
      assert.strictEqual(error.maxBuffer, 1024)
    })

    it("StdioError should be constructable", () => {
      const error = new ChildProcess.StdioError({
        fd: "stdout",
        cause: new Error("Broken pipe")
      })
      assert.strictEqual(error._tag, "StdioError")
      assert.strictEqual(error.fd, "stdout")
    })
  })

  describe("immutability", () => {
    it("configuration functions should not mutate original process", () => {
      const original = ChildProcess.make("node", ["--version"])
      const modified = original.pipe(
        ChildProcess.withCwd("/tmp"),
        ChildProcess.withEnv({ FOO: "bar" })
      )

      assert.deepStrictEqual(original.options, {})
      assert.strictEqual(modified.options.cwd, "/tmp")
      assert.deepStrictEqual(modified.options.env, { FOO: "bar" })
    })

    it("stdio configuration should not mutate original process", () => {
      const original = ChildProcess.make("echo", ["hello"])
      const modified = original.pipe(
        ChildProcess.withStdout("pipe"),
        ChildProcess.withStderr("inherit")
      )

      assert.strictEqual(original.options.stdio, undefined)
      assert.strictEqual(modified.options.stdio?.stdout, "pipe")
      assert.strictEqual(modified.options.stdio?.stderr, "inherit")
    })
  })

  describe("pipe functionality", () => {
    it("should support pipe method for composition", () => {
      const proc = ChildProcess.make("node", ["app.js"]).pipe(
        ChildProcess.withCwd("/app"),
        ChildProcess.withTimeout("10 seconds")
      )

      assert.strictEqual(proc.command, "node")
      assert.strictEqual(proc.options.cwd, "/app")
    })
  })

  describe("toJSON", () => {
    it("should serialize process to JSON", () => {
      const proc = ChildProcess.make("node", ["--version"]).pipe(
        ChildProcess.withCwd("/tmp")
      )

      const json = proc.toJSON() as any

      assert.strictEqual(json._id, "ChildProcess")
      assert.strictEqual(json.command, "node")
      assert.deepStrictEqual(json.args, ["--version"])
      assert.strictEqual(json.options.cwd, "/tmp")
    })
  })
})
