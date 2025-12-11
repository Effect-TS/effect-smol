import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Sink from "effect/stream/Sink"
import * as Stream from "effect/stream/Stream"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

const MockExecutorLayer = Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, {
  spawn: Effect.fnUntraced(function*(command) {
    // For piped commands, flatten to get the first command info
    let cmd = command
    while (cmd._tag === "PipedCommand") {
      cmd = cmd.left
    }
    const executable = cmd._tag === "StandardCommand"
      ? cmd.command
      : "templated"
    return {
      pid: ChildProcessSpawner.ProcessId(12345),
      stdin: Sink.forEach<Uint8Array, void, never, never>((_chunk) => Effect.void),
      stdout: Stream.fromIterable([new TextEncoder().encode(`mock output for ${executable}`)]),
      stderr: Stream.fromIterable([new TextEncoder().encode("")]),
      exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
      isRunning: Effect.succeed(false),
      kill: () => Effect.void
    } as ChildProcessSpawner.ChildProcessHandle
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

  describe("spawn", () => {
    it.effect("should spawn a templated command", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`echo hello`
        const handle = yield* ChildProcess.spawn(cmd)
        assert.strictEqual(handle.pid, ChildProcessSpawner.ProcessId(12345))
      }).pipe(Effect.scoped, Effect.provide(MockExecutorLayer)))

    it.effect("should spawn a standard command", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("node", ["--version"])
        const handle = yield* ChildProcess.spawn(cmd)
        assert.strictEqual(handle.pid, ChildProcessSpawner.ProcessId(12345))
      }).pipe(Effect.scoped, Effect.provide(MockExecutorLayer)))

    it.effect("should return a process handle", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`long-running-process`
        const handle = yield* ChildProcess.spawn(cmd)
        assert.strictEqual(handle.pid, ChildProcessSpawner.ProcessId(12345))
      }).pipe(Effect.scoped, Effect.provide(MockExecutorLayer)))

    it.effect("should allow streaming stdout", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("cat", ["file.txt"])
        const handle = yield* ChildProcess.spawn(cmd)
        const chunks = yield* Stream.runCollect(handle.stdout)
        assert.isTrue(chunks.length > 0)
      }).pipe(Effect.scoped, Effect.provide(MockExecutorLayer)))

    it.effect("should allow waiting for exit code", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make`echo test`
        const handle = yield* ChildProcess.spawn(cmd)
        const exitCode = yield* handle.exitCode
        assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
      }).pipe(Effect.scoped, Effect.provide(MockExecutorLayer)))
  })

  describe("pipeTo", () => {
    it("should create a piped command", () => {
      const pipeline = ChildProcess.make`cat file.txt`.pipe(
        ChildProcess.pipeTo(ChildProcess.make`grep pattern`),
        ChildProcess.pipeTo(ChildProcess.make`wc -l`)
      )
      assert.strictEqual(pipeline._tag, "PipedCommand")
    })

    it.effect("should allow spawning a pipeline", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make`cat file.txt`.pipe(
          ChildProcess.pipeTo(ChildProcess.make`grep pattern`)
        )
        const handle = yield* ChildProcess.spawn(pipeline)
        assert.strictEqual(handle.pid, ChildProcessSpawner.ProcessId(12345))
      }).pipe(Effect.scoped, Effect.provide(MockExecutorLayer)))
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
