import { NodeChildProcessExecutor } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Stream from "effect/stream/Stream"
import type { ChildProcessError } from "effect/unstable/process"
import { ChildProcess } from "effect/unstable/process"

describe("NodeChildProcessExecutor", () => {
  describe("exec", () => {
    describe("basic execution", () => {
      it.effect("should execute a simple command and collect output", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("node", ["--version"])
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          assert.isTrue(result.stdout instanceof Uint8Array)
          assert.isTrue((result.stdout as Uint8Array).length > 0)

          // Verify it contains "v" (version string starts with v)
          const output = new TextDecoder().decode(result.stdout as Uint8Array)
          assert.isTrue(output.includes("v"))
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should execute echo command", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("echo", ["hello", "world"])
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "hello world")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should track command duration", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sleep", ["0.1"])
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          // Duration should be at least 100ms
          assert.isTrue(Duration.toMillis(result.duration) >= 50)
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("cwd option", () => {
      it.effect("should handle command with working directory", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("pwd", [], { cwd: "/tmp" })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          // On macOS, /tmp is a symlink to /private/tmp
          assert.isTrue(output.includes("tmp"))
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should use cwd with template literal form", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make({ cwd: "/tmp" })`pwd`
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.isTrue(output.includes("tmp"))
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("env option", () => {
      it.effect("should handle environment variables", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo $TEST_VAR"], {
            env: { TEST_VAR: "test_value" }
          })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "test_value")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should merge with existing environment", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo $PATH"], {
            env: { CUSTOM_VAR: "custom" }
          })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          // PATH should still be present from parent process
          assert.isTrue(output.length > 0)
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should handle multiple environment variables", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo $VAR1-$VAR2-$VAR3"], {
            env: { VAR1: "one", VAR2: "two", VAR3: "three" }
          })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "one-two-three")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("encoding option", () => {
      it.effect("should return Uint8Array by default (buffer encoding)", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("echo", ["hello"])
          const result = yield* ChildProcess.exec(cmd)

          assert.isTrue(result.stdout instanceof Uint8Array)
          assert.isTrue(result.stderr instanceof Uint8Array)
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should return string with utf8 encoding", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("echo", ["hello"], { encoding: "utf8" })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(typeof result.stdout, "string")
          assert.strictEqual(typeof result.stderr, "string")
          assert.strictEqual((result.stdout as string).trim(), "hello")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should handle utf8 encoding with stderr", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo error >&2"], { encoding: "utf8" })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(typeof result.stderr, "string")
          assert.strictEqual((result.stderr as string).trim(), "error")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("shell option", () => {
      it.effect("should execute with shell when using sh -c", () =>
        Effect.gen(function*() {
          // Use sh -c to test shell expansion without triggering deprecation warning
          const cmd = ChildProcess.make("sh", ["-c", "echo $HOME"])
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          // With shell, $HOME should be expanded
          assert.isTrue(output.length > 0)
          assert.isFalse(output.includes("$HOME"))
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should not expand variables without shell", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("echo", ["$HOME"], { shell: false })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          // Without shell, $HOME should not be expanded
          assert.strictEqual(output, "$HOME")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should allow piping with shell", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo hello | tr a-z A-Z"])
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "HELLO")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("timeout option", () => {
      it.effect("should complete before timeout", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("echo", ["quick"], { timeout: "5 seconds" })
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "quick")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("template literal forms", () => {
      it.effect("should work with template literal form", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make`echo hello`
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "hello")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should handle string interpolation", () =>
        Effect.gen(function*() {
          const name = "world"
          const cmd = ChildProcess.make`echo hello ${name}`
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "hello world")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should handle number interpolation", () =>
        Effect.gen(function*() {
          const count = 42
          const cmd = ChildProcess.make`echo count is ${count}`
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "count is 42")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should handle array interpolation", () =>
        Effect.gen(function*() {
          const args = ["-l", "-a"]
          const cmd = ChildProcess.make`ls ${args} /tmp`
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          // Should list files in /tmp with -l -a flags
          assert.isTrue((result.stdout as Uint8Array).length > 0)
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should handle multiple interpolations", () =>
        Effect.gen(function*() {
          const greeting = "hello"
          const target = "world"
          const cmd = ChildProcess.make`echo ${greeting} ${target}`
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          assert.strictEqual(output, "hello world")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should handle options with template literal", () =>
        Effect.gen(function*() {
          const filename = "test.txt"
          const cmd = ChildProcess.make({ cwd: "/tmp", encoding: "utf8" })`echo ${filename}`
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          assert.strictEqual(typeof result.stdout, "string")
          assert.strictEqual((result.stdout as string).trim(), "test.txt")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("stderr handling", () => {
      it.effect("should capture stderr output", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo error message >&2"])
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const stderr = new TextDecoder().decode(result.stderr as Uint8Array).trim()
          assert.strictEqual(stderr, "error message")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should capture both stdout and stderr", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo stdout; echo stderr >&2"])
          const result = yield* ChildProcess.exec(cmd)

          assert.strictEqual(result.exitCode, 0)
          const stdout = new TextDecoder().decode(result.stdout as Uint8Array).trim()
          const stderr = new TextDecoder().decode(result.stderr as Uint8Array).trim()
          assert.strictEqual(stdout, "stdout")
          assert.strictEqual(stderr, "stderr")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })
  })

  describe("pipeline execution", () => {
    it.effect("should execute a simple pipeline", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make`echo hello world`.pipe(
          ChildProcess.pipeTo(ChildProcess.make`tr a-z A-Z`)
        )
        const result = yield* ChildProcess.exec(pipeline)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
        assert.strictEqual(output, "HELLO WORLD")
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should execute a three-stage pipeline", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make`echo hello world`.pipe(
          ChildProcess.pipeTo(ChildProcess.make`tr a-z A-Z`),
          ChildProcess.pipeTo(ChildProcess.make("tr", [" ", "-"]))
        )
        const result = yield* ChildProcess.exec(pipeline)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
        assert.strictEqual(output, "HELLO-WORLD")
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should pipe grep output", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make("echo", ["line1\nline2\nline3"]).pipe(
          ChildProcess.pipeTo(ChildProcess.make`grep line2`)
        )
        const result = yield* ChildProcess.exec(pipeline)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
        assert.strictEqual(output, "line2")
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should handle pipeline with encoding option", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make`echo test`.pipe(
          ChildProcess.pipeTo(ChildProcess.make({ encoding: "utf8" })`cat`)
        )
        const result = yield* ChildProcess.exec(pipeline)

        assert.strictEqual(result.exitCode, 0)
        assert.strictEqual(typeof result.stdout, "string")
        assert.strictEqual((result.stdout as string).trim(), "test")
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should handle mixed command forms in pipeline", () =>
      Effect.gen(function*() {
        const pipeline = ChildProcess.make("echo", ["hello"]).pipe(
          ChildProcess.pipeTo(ChildProcess.make`tr a-z A-Z`)
        )
        const result = yield* ChildProcess.exec(pipeline)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout as Uint8Array).trim()
        assert.strictEqual(output, "HELLO")
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
  })

  describe("spawn", () => {
    describe("basic spawning", () => {
      it.effect("should spawn a process and get handle", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("echo", ["test"])
          const handle = yield* ChildProcess.spawn(cmd)

          assert.isTrue(handle.pid._tag === "Some")

          const exitCode = yield* handle.exitCode
          assert.strictEqual(exitCode, 0)
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should spawn with template literal", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make`echo spawned`
          const handle = yield* ChildProcess.spawn(cmd)

          assert.isTrue(handle.pid._tag === "Some")

          const exitCode = yield* handle.exitCode
          assert.strictEqual(exitCode, 0)
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("stdout streaming", () => {
      it.effect("should stream stdout", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("echo", ["streaming output"])
          const handle = yield* ChildProcess.spawn(cmd)

          const chunks = yield* Stream.runCollect(handle.stdout)
          // Concatenate Uint8Arrays properly
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
          const result = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.length
          }
          const output = new TextDecoder().decode(result).trim()
          assert.strictEqual(output, "streaming output")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should stream multiple lines", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo line1; echo line2; echo line3"])
          const handle = yield* ChildProcess.spawn(cmd)

          const chunks = yield* Stream.runCollect(handle.stdout)
          // Concatenate Uint8Arrays properly
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
          const result = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.length
          }
          const output = new TextDecoder().decode(result).trim()
          assert.isTrue(output.includes("line1"))
          assert.isTrue(output.includes("line2"))
          assert.isTrue(output.includes("line3"))
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("stderr streaming", () => {
      it.effect("should stream stderr", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sh", ["-c", "echo error >&2"])
          const handle = yield* ChildProcess.spawn(cmd)

          const chunks = yield* Stream.runCollect(handle.stderr)
          // Concatenate Uint8Arrays properly
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
          const result = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.length
          }
          const output = new TextDecoder().decode(result).trim()
          assert.strictEqual(output, "error")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })

    describe("process control", () => {
      it.effect("should kill a process", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sleep", ["10"])
          const handle = yield* ChildProcess.spawn(cmd)

          assert.isTrue(handle.pid._tag === "Some")

          yield* handle.kill()

          // After killing, exitCode should eventually resolve (with signal error)
          const exit = yield* Effect.exit(handle.exitCode)
          assert.isTrue(exit._tag === "Failure")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

      it.effect("should kill with specific signal", () =>
        Effect.gen(function*() {
          const cmd = ChildProcess.make("sleep", ["10"])
          const handle = yield* ChildProcess.spawn(cmd)

          yield* handle.kill("SIGKILL")

          const exit = yield* Effect.exit(handle.exitCode)
          assert.isTrue(exit._tag === "Failure")
        }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
    })
  })

  describe("error handling", () => {
    it.effect("should fail with ExitCodeError for non-zero exit", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("sh", ["-c", "exit 1"])
        const exit = yield* Effect.exit(ChildProcess.exec(cmd))

        assert.isTrue(exit._tag === "Failure")
        if (exit._tag === "Failure") {
          const failure = exit.cause.failures.find((f: { _tag: string }) => f._tag === "Fail")
          assert.ok(failure, "Expected to find a Fail cause")
          const error = (failure as { error: ChildProcessError.ChildProcessError }).error
          assert.strictEqual(error._tag, "ExitCodeError")
          if (error._tag === "ExitCodeError") {
            assert.strictEqual(error.exitCode, 1)
          }
        }
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should include stdout and stderr in ExitCodeError", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("sh", ["-c", "echo stdout; echo stderr >&2; exit 2"], { encoding: "utf8" })
        const exit = yield* Effect.exit(ChildProcess.exec(cmd))

        assert.isTrue(exit._tag === "Failure")
        if (exit._tag === "Failure") {
          const failure = exit.cause.failures.find((f: { _tag: string }) => f._tag === "Fail")
          assert.ok(failure, "Expected to find a Fail cause")
          const error = (failure as { error: ChildProcessError.ChildProcessError }).error
          assert.strictEqual(error._tag, "ExitCodeError")
          if (error._tag === "ExitCodeError") {
            assert.strictEqual(error.exitCode, 2)
            assert.strictEqual((error.stdout as string).trim(), "stdout")
            assert.strictEqual((error.stderr as string).trim(), "stderr")
          }
        }
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should fail with SpawnError for invalid command", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("nonexistent-command-12345", [])
        const exit = yield* Effect.exit(ChildProcess.exec(cmd))

        assert.isTrue(exit._tag === "Failure")
        if (exit._tag === "Failure") {
          const failure = exit.cause.failures.find((f: { _tag: string }) => f._tag === "Fail")
          assert.ok(failure, "Expected to find a Fail cause")
          const error = (failure as { error: ChildProcessError.ChildProcessError }).error
          assert.strictEqual(error._tag, "SpawnError")
        }
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should fail with different exit codes", () =>
      Effect.gen(function*() {
        for (const exitCode of [1, 2, 127, 255]) {
          const cmd = ChildProcess.make("sh", ["-c", `exit ${exitCode}`])
          const exit = yield* Effect.exit(ChildProcess.exec(cmd))

          assert.isTrue(exit._tag === "Failure")
          if (exit._tag === "Failure") {
            const failure = exit.cause.failures.find((f: { _tag: string }) => f._tag === "Fail")
            const error = (failure as { error: ChildProcessError.ChildProcessError }).error
            if (error._tag === "ExitCodeError") {
              assert.strictEqual(error.exitCode, exitCode)
            }
          }
        }
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should handle spawn error with invalid cwd", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("echo", ["test"], { cwd: "/nonexistent/directory/path" })
        const exit = yield* Effect.exit(ChildProcess.exec(cmd))

        assert.isTrue(exit._tag === "Failure")
        if (exit._tag === "Failure") {
          const failure = exit.cause.failures.find((f: { _tag: string }) => f._tag === "Fail")
          assert.ok(failure, "Expected to find a Fail cause")
          const error = (failure as { error: ChildProcessError.ChildProcessError }).error
          assert.strictEqual(error._tag, "SpawnError")
        }
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
  })

  describe("combined options", () => {
    it.effect("should handle cwd + env together", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("sh", ["-c", "pwd; echo $MY_VAR"], {
          cwd: "/tmp",
          env: { MY_VAR: "custom_value" }
        })
        const result = yield* ChildProcess.exec(cmd)

        assert.strictEqual(result.exitCode, 0)
        const output = new TextDecoder().decode(result.stdout as Uint8Array)
        assert.isTrue(output.includes("tmp"))
        assert.isTrue(output.includes("custom_value"))
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should handle encoding + timeout together", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("echo", ["quick"], {
          encoding: "utf8",
          timeout: "5 seconds"
        })
        const result = yield* ChildProcess.exec(cmd)

        assert.strictEqual(result.exitCode, 0)
        assert.strictEqual(typeof result.stdout, "string")
        assert.strictEqual((result.stdout as string).trim(), "quick")
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))

    it.effect("should handle all options together", () =>
      Effect.gen(function*() {
        const cmd = ChildProcess.make("sh", ["-c", "pwd; echo $TEST_VAR"], {
          cwd: "/tmp",
          env: { TEST_VAR: "all_options" },
          encoding: "utf8",
          timeout: "5 seconds",
          shell: false
        })
        const result = yield* ChildProcess.exec(cmd)

        assert.strictEqual(result.exitCode, 0)
        const stdout = result.stdout as string
        assert.isTrue(stdout.includes("tmp"))
        assert.isTrue(stdout.includes("all_options"))
      }).pipe(Effect.provide(NodeChildProcessExecutor.layer)))
  })
})
