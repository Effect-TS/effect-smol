import { NodeProcessExecutor } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"

describe("NodeProcessExecutor", () => {
  describe("execute", () => {
    it.effect.only("should execute a simple command and collect output", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("node", ["--version"])
        const result = yield* ChildProcess.execute(proc)

        assert.strictEqual(result.exitCode, 0)
        assert.strictEqual(result.signal, undefined)
        assert.isTrue(result.stdout instanceof Uint8Array)
        assert.isTrue(result.stdout.length > 0)

        // Verify it contains "v" (version string starts with v)
        const output = new TextDecoder().decode(result.stdout)
        assert.isTrue(output.includes("v"))
      }).pipe(Effect.provide(NodeProcessExecutor.layer)))

    it.effect("should execute echo command", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("echo", ["hello", "world"])
        const result = yield* ChildProcess.execute(proc)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout).trim()
        assert.strictEqual(output, "hello world")
      }).pipe(Effect.provide(NodeProcessExecutor.layer)))

    it.effect("should handle command with working directory", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("pwd", []).pipe(
          ChildProcess.withCwd("/tmp")
        )
        const result = yield* ChildProcess.execute(proc)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout).trim()
        assert.strictEqual(output, "/tmp")
      }).pipe(Effect.provide(NodeProcessExecutor.layer)))

    it.effect("should handle environment variables", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.shell("echo $TEST_VAR").pipe(
          ChildProcess.withEnv({ TEST_VAR: "test_value" })
        )
        const result = yield* ChildProcess.execute(proc)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout).trim()
        assert.strictEqual(output, "test_value")
      }).pipe(Effect.provide(NodeProcessExecutor.layer)))
  })

  describe("spawn", () => {
    it.effect("should spawn a process and get handle", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("echo", ["test"])
        const handle = yield* ChildProcess.spawn(proc)

        assert.isTrue(handle.pid !== undefined)
        assert.isTrue(handle.pid! > 0)

        const exitInfo = yield* handle.exitCode
        assert.strictEqual(exitInfo.exitCode, 0)
        assert.strictEqual(exitInfo.signal, undefined)
      }).pipe(Effect.provide(NodeProcessExecutor.layer)))
  })

  describe("error handling", () => {
    it.effect("should fail with ExitCodeError for non-zero exit", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.shell("exit 1")
        const exit = yield* Effect.exit(ChildProcess.execute(proc))

        assert.isTrue(exit._tag === "Failure")
        if (exit._tag === "Failure") {
          const error = exit.cause.value as ChildProcess.ChildProcessError
          assert.strictEqual(error._tag, "ExitCodeError")
          if (error._tag === "ExitCodeError") {
            assert.strictEqual(error.exitCode, 1)
          }
        }
      }).pipe(Effect.provide(NodeProcessExecutor.layer)))

    it.effect("should fail with SpawnError for invalid command", () =>
      Effect.gen(function*() {
        const proc = ChildProcess.make("nonexistent-command-12345", [])
        const exit = yield* Effect.exit(ChildProcess.execute(proc))

        assert.isTrue(exit._tag === "Failure")
        if (exit._tag === "Failure") {
          const error = exit.cause.value as ChildProcess.ChildProcessError
          assert.strictEqual(error._tag, "SpawnError")
        }
      }).pipe(Effect.provide(NodeProcessExecutor.layer)))
  })
})
