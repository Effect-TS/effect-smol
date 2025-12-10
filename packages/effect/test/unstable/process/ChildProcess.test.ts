import { assert, describe, it } from "@effect/vitest"
import { Option } from "effect/data"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Sink from "effect/stream/Sink"
import * as Stream from "effect/stream/Stream"
import { ChildProcess, ChildProcessError, ChildProcessExecutor } from "effect/unstable/process"

const MockExecutorLayer = Layer.succeed(ChildProcessExecutor.ChildProcessExecutor, {
  exec: Effect.fnUntraced(function*(command) {
    const startTime = Date.now()
    const resolved = yield* ChildProcess.resolveAll(command)
    const pipeSettings = ChildProcess.collectPipeSettings(command)

    if (resolved.length === 1) {
      const cmd = resolved[0]
      return {
        executable: cmd.executable,
        args: cmd.args,
        exitCode: 0,
        stdout: new TextEncoder().encode("mock stdout"),
        stderr: new TextEncoder().encode(""),
        duration: Duration.millis(Date.now() - startTime)
      } as ChildProcessExecutor.ChildProcessResult
    }

    // Pipeline - return result of last command
    const lastCmd = resolved[resolved.length - 1]
    return {
      executable: lastCmd.executable,
      args: lastCmd.args,
      exitCode: 0,
      stdout: new TextEncoder().encode(`piped output (${pipeSettings.length} pipes)`),
      stderr: new TextEncoder().encode(""),
      duration: Duration.millis(Date.now() - startTime)
    } as ChildProcessExecutor.ChildProcessResult
  }),
  spawn: Effect.fnUntraced(function*(command) {
    const resolved = yield* ChildProcess.resolve(command)
    return {
      pid: Option.some(12345),
      stdin: Sink.forEach<Uint8Array, void, never, never>((_chunk) => Effect.void),
      stdout: Stream.fromIterable([new TextEncoder().encode(`mock output for ${resolved.executable}`)]),
      stderr: Stream.fromIterable([new TextEncoder().encode("")]),
      exitCode: Effect.succeed(0),
      kill: () => Effect.void
    } as ChildProcessExecutor.ChildProcessHandle
  })
})

describe("ChildProcess", () => {
  describe("make", () => {
    it("template literal form should create a templated command", () => {
      const cmd = ChildProcess.make`echo hello`
      assert.strictEqual(cmd._tag, "TemplatedCommand")
      assert.isTrue(ChildProcess.isTemplatedCommand(cmd))
      // Templates are stored unparsed
      if (cmd._tag === "TemplatedCommand") {
        assert.strictEqual(cmd.templates.length, 1)
      }
    })

    it("array form should create a standard command", () => {
      const cmd = ChildProcess.make("node", ["--version"])
      assert.strictEqual(cmd._tag, "StandardCommand")
      assert.isTrue(ChildProcess.isStandardCommand(cmd))
      assert.strictEqual(cmd.command, "node")
      assert.deepStrictEqual(cmd.args, ["--version"])
    })

    it("options form should pass options to templated command", () => {
      const cmd = ChildProcess.make({ cwd: "/tmp" })`ls -la`
      assert.strictEqual(cmd._tag, "TemplatedCommand")
      assert.strictEqual(cmd.options.cwd, "/tmp")
    })

    it("array form with options should work", () => {
      const cmd = ChildProcess.make("git", ["status"], { cwd: "/app" })
      assert.strictEqual(cmd._tag, "StandardCommand")
      assert.strictEqual(cmd.command, "git")
      assert.deepStrictEqual(cmd.args, ["status"])
      assert.strictEqual(cmd.options.cwd, "/app")
    })
  })

  describe("exec", () => {
    it.effect("should execute a templated command", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`echo hello`
        const result = yield* ChildProcess.exec(cmd)
        assert.strictEqual(result.exitCode, 0)
        assert.strictEqual(result.executable, "echo")
        assert.deepStrictEqual(result.args, ["hello"])
      }).pipe(Effect.provide(MockExecutorLayer)))

    it.effect("should execute a standard command", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("node", ["--version"])
        const result = yield* ChildProcess.exec(cmd)
        assert.strictEqual(result.exitCode, 0)
        assert.strictEqual(result.executable, "node")
        assert.deepStrictEqual(result.args, ["--version"])
      }).pipe(Effect.provide(MockExecutorLayer)))
  })

  describe("spawn", () => {
    it.effect("should return a process handle", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`long-running-process`
        const handle = yield* ChildProcess.spawn(cmd)
        assert.isTrue(Option.isSome(handle.pid))
        assert.strictEqual(Option.getOrNull(handle.pid), 12345)
      }).pipe(Effect.provide(MockExecutorLayer)))

    it.effect("should allow streaming stdout", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("cat", ["file.txt"])
        const handle = yield* ChildProcess.spawn(cmd)
        const chunks = yield* Stream.runCollect(handle.stdout)
        assert.isTrue(chunks.length > 0)
      }).pipe(Effect.provide(MockExecutorLayer)))

    it.effect("should allow waiting for exit code", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`echo test`
        const handle = yield* ChildProcess.spawn(cmd)
        const exitCode = yield* handle.exitCode
        assert.strictEqual(exitCode, 0)
      }).pipe(Effect.provide(MockExecutorLayer)))
  })

  describe("pipeTo", () => {
    it.effect("should pipe output from one command to another", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make`cat file.txt`.pipe(
          ChildProcess.pipeTo(ChildProcess.make`grep pattern`),
          ChildProcess.pipeTo(ChildProcess.make`wc -l`)
        )
        const result = yield* ChildProcess.exec(pipeline)
        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout as Uint8Array)
        assert.strictEqual(output, "piped output (2 pipes)")
      }).pipe(Effect.provide(MockExecutorLayer)))

    it("should create a piped command with stdio option", () => {
      const pipeline = ChildProcess.make`cmd1`.pipe(
        ChildProcess.pipeTo(ChildProcess.make`cmd2`, { stdio: "stderr" })
      )
      assert.strictEqual(pipeline._tag, "PipedCommand")
      assert.strictEqual(pipeline.pipeStdio, "stderr")
    })
  })

  describe("resolve", () => {
    it.effect("should resolve a standard command", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("echo", ["hello"])
        const resolved = yield* ChildProcess.resolve(cmd)
        assert.strictEqual(resolved.executable, "echo")
        assert.deepStrictEqual(resolved.args, ["hello"])
      }))

    it.effect("should resolve a templated command by parsing", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`echo hello world`
        const resolved = yield* ChildProcess.resolve(cmd)
        assert.strictEqual(resolved.executable, "echo")
        assert.deepStrictEqual(resolved.args, ["hello", "world"])
      }))

    it.effect("should handle interpolated values", () =>
      Effect.gen(function*() {
        const name = "test"
        const cmd = ChildProcess.make`echo ${name}`
        const resolved = yield* ChildProcess.resolve(cmd)
        assert.strictEqual(resolved.executable, "echo")
        assert.deepStrictEqual(resolved.args, ["test"])
      }))

    it.effect("should handle array interpolation", () =>
      Effect.gen(function*() {
        const flags = ["-l", "-a"]
        const cmd = ChildProcess.make`ls ${flags}`
        const resolved = yield* ChildProcess.resolve(cmd)
        assert.strictEqual(resolved.executable, "ls")
        assert.deepStrictEqual(resolved.args, ["-l", "-a"])
      }))
  })

  describe("resolveAll", () => {
    it.effect("should resolve a single command", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`echo hello`
        const resolved = yield* ChildProcess.resolveAll(cmd)
        assert.strictEqual(resolved.length, 1)
        assert.strictEqual(resolved[0].executable, "echo")
      }))

    it.effect("should resolve a piped command", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make`cat file`.pipe(
          ChildProcess.pipeTo(ChildProcess.make`grep pattern`),
          ChildProcess.pipeTo(ChildProcess.make`wc -l`)
        )
        const resolved = yield* ChildProcess.resolveAll(pipeline)
        assert.strictEqual(resolved.length, 3)
        assert.strictEqual(resolved[0].executable, "cat")
        assert.strictEqual(resolved[1].executable, "grep")
        assert.strictEqual(resolved[2].executable, "wc")
      }))
  })

  describe("collectPipeSettings", () => {
    it("should return empty array for single command", () => {
      const cmd = ChildProcess.make`echo hello`
      const settings = ChildProcess.collectPipeSettings(cmd)
      assert.strictEqual(settings.length, 0)
    })

    it("should collect pipe settings from pipeline", () => {
      const pipeline = ChildProcess.make`cmd1`.pipe(
        ChildProcess.pipeTo(ChildProcess.make`cmd2`, { stdio: "stderr" }),
        ChildProcess.pipeTo(ChildProcess.make`cmd3`, { stdio: "both" })
      )
      const settings = ChildProcess.collectPipeSettings(pipeline)
      assert.strictEqual(settings.length, 2)
      assert.strictEqual(settings[0], "stderr")
      assert.strictEqual(settings[1], "both")
    })

    it("should default to stdout", () => {
      const pipeline = ChildProcess.make`cmd1`.pipe(
        ChildProcess.pipeTo(ChildProcess.make`cmd2`)
      )
      const settings = ChildProcess.collectPipeSettings(pipeline)
      assert.strictEqual(settings.length, 1)
      assert.strictEqual(settings[0], "stdout")
    })
  })

  describe("error types", () => {
    it("SpawnError should be constructable", () => {
      const error = new ChildProcessError.SpawnError({
        executable: "node",
        args: ["--version"],
        cause: new Error("ENOENT")
      })
      assert.strictEqual(error._tag, "SpawnError")
      assert.strictEqual(error.executable, "node")
    })

    it("ExitCodeError should be constructable", () => {
      const error = new ChildProcessError.ExitCodeError({
        executable: "npm",
        args: ["test"],
        exitCode: 1,
        stdout: new Uint8Array(),
        stderr: new Uint8Array()
      })
      assert.strictEqual(error._tag, "ExitCodeError")
      assert.strictEqual(error.executable, "npm")
      assert.strictEqual(error.exitCode, 1)
    })

    it("TimeoutError should be constructable", () => {
      const error = new ChildProcessError.TimeoutError({
        executable: "node",
        args: ["app.js"],
        timeout: Duration.seconds(5)
      })
      assert.strictEqual(error._tag, "TimeoutError")
      assert.deepStrictEqual(error.timeout, Duration.seconds(5))
    })

    it("KilledError should be constructable", () => {
      const error = new ChildProcessError.KilledError({
        executable: "node",
        args: ["app.js"],
        signal: "SIGTERM"
      })
      assert.strictEqual(error._tag, "KilledError")
      assert.strictEqual(error.signal, "SIGTERM")
    })

    it("InvalidArgumentsError should be constructable", () => {
      const error = new ChildProcessError.InvalidArgumentsError({
        message: "Template script must not be empty"
      })
      assert.strictEqual(error._tag, "InvalidArgumentsError")
      assert.strictEqual(error.message, "Template script must not be empty")
    })
  })

  describe("guards", () => {
    it("isCommand should detect commands", () => {
      const cmd = ChildProcess.make`echo hello`
      assert.isTrue(ChildProcess.isCommand(cmd))
      assert.isFalse(ChildProcess.isCommand({ _tag: "Other" }))
      assert.isFalse(ChildProcess.isCommand(null))
    })

    it("isStandardCommand should detect standard commands", () => {
      const standard = ChildProcess.make("echo", ["hello"])
      const templated = ChildProcess.make`echo hello`
      const piped = ChildProcess.make`cat file`.pipe(
        ChildProcess.pipeTo(ChildProcess.make`grep pattern`)
      )
      assert.isTrue(ChildProcess.isStandardCommand(standard))
      assert.isFalse(ChildProcess.isStandardCommand(templated))
      assert.isFalse(ChildProcess.isStandardCommand(piped))
    })

    it("isTemplatedCommand should detect templated commands", () => {
      const standard = ChildProcess.make("echo", ["hello"])
      const templated = ChildProcess.make`echo hello`
      const piped = ChildProcess.make`cat file`.pipe(
        ChildProcess.pipeTo(ChildProcess.make`grep pattern`)
      )
      assert.isFalse(ChildProcess.isTemplatedCommand(standard))
      assert.isTrue(ChildProcess.isTemplatedCommand(templated))
      assert.isFalse(ChildProcess.isTemplatedCommand(piped))
    })

    it("isPipedCommand should detect piped commands", () => {
      const single = ChildProcess.make`echo hello`
      const piped = ChildProcess.make`cat file`.pipe(
        ChildProcess.pipeTo(ChildProcess.make`grep pattern`)
      )
      assert.isFalse(ChildProcess.isPipedCommand(single))
      assert.isTrue(ChildProcess.isPipedCommand(piped))
    })
  })
})
