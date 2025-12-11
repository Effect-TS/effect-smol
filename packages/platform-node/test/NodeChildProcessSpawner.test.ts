import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Stream from "effect/stream/Stream"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

// Helper to collect stream output into a string
const collectStreamOutput = (stream: Stream.Stream<Uint8Array, unknown>) =>
  Effect.gen(function*() {
    const chunks = yield* Stream.runCollect(stream)
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return new TextDecoder().decode(result).trim()
  })

describe("NodeChildProcessSpawner", () => {
  describe("spawn", () => {
    describe("basic spawning", () => {
      it.effect("should spawn a simple command and collect output", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("node", ["--version"])
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          // Verify it contains "v" (version string starts with v)
          assert.isTrue(output.includes("v"))
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should spawn echo command", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("echo", ["hello", "world"])
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "hello world")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should spawn with template literal", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make`echo spawned`
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "spawned")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })

    describe("cwd option", () => {
      it.effect("should handle command with working directory", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("pwd", [], { cwd: "/tmp" })
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          // On macOS, /tmp is a symlink to /private/tmp
          assert.isTrue(output.includes("tmp"))
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should use cwd with template literal form", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make({ cwd: "/tmp" })`pwd`
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.isTrue(output.includes("tmp"))
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })

    describe("env option", () => {
      it.effect("should handle environment variables", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sh", ["-c", "echo $TEST_VAR"], {
            env: { TEST_VAR: "test_value" },
            extendEnv: true
          })
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "test_value")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should handle multiple environment variables", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sh", ["-c", "echo $VAR1-$VAR2-$VAR3"], {
            env: { VAR1: "one", VAR2: "two", VAR3: "three" },
            extendEnv: true
          })
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "one-two-three")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })

    describe("shell option", () => {
      it.effect("should execute with shell when using sh -c", () =>
        Effect.gen(function*() {
          // Use sh -c to test shell expansion without triggering deprecation warning
          const handle = yield* ChildProcess.make("sh", ["-c", "echo $HOME"])
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          // With shell, $HOME should be expanded
          assert.isTrue(output.length > 0)
          assert.isFalse(output.includes("$HOME"))
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should not expand variables without shell", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("echo", ["$HOME"], { shell: false })
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          // Without shell, $HOME should not be expanded
          assert.strictEqual(output, "$HOME")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should allow piping with shell", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sh", ["-c", "echo hello | tr a-z A-Z"])
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "HELLO")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })

    describe("template literal forms", () => {
      it.effect("should work with template literal form", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make`echo hello`
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "hello")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should handle string interpolation", () =>
        Effect.gen(function*() {
          const name = "world"
          const handle = yield* ChildProcess.make`echo hello ${name}`
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "hello world")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should handle number interpolation", () =>
        Effect.gen(function*() {
          const count = 42
          const handle = yield* ChildProcess.make`echo count is ${count}`
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "count is 42")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should handle array interpolation", () =>
        Effect.gen(function*() {
          const args = ["-l", "-a"]
          const handle = yield* ChildProcess.make`ls ${args} /tmp`
          const exitCode = yield* handle.exitCode
          const output = yield* collectStreamOutput(handle.stdout)

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          // Should list files in /tmp with -l -a flags
          assert.isTrue(output.length > 0)
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should handle multiple interpolations", () =>
        Effect.gen(function*() {
          const greeting = "hello"
          const target = "world"
          const handle = yield* ChildProcess.make`echo ${greeting} ${target}`
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "hello world")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should handle options with template literal", () =>
        Effect.gen(function*() {
          const filename = "test.txt"
          const handle = yield* ChildProcess.make({ cwd: "/tmp" })`echo ${filename}`
          const output = yield* collectStreamOutput(handle.stdout)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(output, "test.txt")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })

    describe("stderr streaming", () => {
      it.effect("should capture stderr output", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sh", ["-c", "echo error message >&2"])
          const stderr = yield* collectStreamOutput(handle.stderr)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(stderr, "error message")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should capture both stdout and stderr", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sh", ["-c", "echo stdout; echo stderr >&2"])
          const stdout = yield* collectStreamOutput(handle.stdout)
          const stderr = yield* collectStreamOutput(handle.stderr)
          const exitCode = yield* handle.exitCode

          assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
          assert.strictEqual(stdout, "stdout")
          assert.strictEqual(stderr, "stderr")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })

    describe("stdout streaming", () => {
      it.effect("should stream stdout", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("echo", ["streaming output"])
          const output = yield* collectStreamOutput(handle.stdout)

          assert.strictEqual(output, "streaming output")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should stream multiple lines", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sh", ["-c", "echo line1; echo line2; echo line3"])
          const output = yield* collectStreamOutput(handle.stdout)

          assert.isTrue(output.includes("line1"))
          assert.isTrue(output.includes("line2"))
          assert.isTrue(output.includes("line3"))
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })

    describe("process control", () => {
      it.effect("should kill a process", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sleep", ["10"])

          yield* handle.kill()

          // After killing, exitCode should eventually resolve (with signal error)
          const exit = yield* Effect.exit(handle.exitCode)
          assert.isTrue(exit._tag === "Failure")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

      it.effect("should kill with specific signal", () =>
        Effect.gen(function*() {
          const handle = yield* ChildProcess.make("sleep", ["10"])

          yield* handle.kill({ killSignal: "SIGKILL" })

          const exit = yield* Effect.exit(handle.exitCode)
          assert.isTrue(exit._tag === "Failure")
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
    })
  })

  describe("pipeline spawning", () => {
    it.effect("should spawn a simple pipeline", () =>
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make`echo hello world`.pipe(
          ChildProcess.pipeTo(ChildProcess.make`tr a-z A-Z`)
        )
        const output = yield* collectStreamOutput(handle.stdout)
        const exitCode = yield* handle.exitCode

        assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
        assert.strictEqual(output, "HELLO WORLD")
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

    it.effect("should spawn a three-stage pipeline", () =>
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make`echo hello world`.pipe(
          ChildProcess.pipeTo(ChildProcess.make`tr a-z A-Z`),
          ChildProcess.pipeTo(ChildProcess.make("tr", [" ", "-"]))
        )
        const output = yield* collectStreamOutput(handle.stdout)
        const exitCode = yield* handle.exitCode

        assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
        assert.strictEqual(output, "HELLO-WORLD")
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

    it.effect("should pipe grep output", () =>
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make("echo", ["line1\nline2\nline3"]).pipe(
          ChildProcess.pipeTo(ChildProcess.make`grep line2`)
        )
        const output = yield* collectStreamOutput(handle.stdout)
        const exitCode = yield* handle.exitCode

        assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
        assert.strictEqual(output, "line2")
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

    it.effect("should handle mixed command forms in pipeline", () =>
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make("echo", ["hello"]).pipe(
          ChildProcess.pipeTo(ChildProcess.make`tr a-z A-Z`)
        )
        const output = yield* collectStreamOutput(handle.stdout)
        const exitCode = yield* handle.exitCode

        assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
        assert.strictEqual(output, "HELLO")
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
  })

  describe("error handling", () => {
    it.effect("should return non-zero exit code", () =>
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make("sh", ["-c", "exit 1"])
        const exitCode = yield* handle.exitCode

        assert.strictEqual(exitCode, ChildProcessSpawner.ExitCode(1))
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

    it.effect("should fail for invalid command", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          ChildProcess.make("nonexistent-command-12345").asEffect()
        )

        assert.isTrue(exit._tag === "Failure")
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

    it.effect("should handle spawn error with invalid cwd", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          ChildProcess.make("echo", ["test"], { cwd: "/nonexistent/directory/path" }).asEffect()
        )

        assert.isTrue(exit._tag === "Failure")
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
  })

  describe("stdin", () => {
    it.effect("allows providing standard input to a command", () =>
      Effect.gen(function*() {
        const input = "a b c"
        const stdin = Stream.make(Buffer.from(input, "utf-8"))
        const handle = yield* ChildProcess.make("cat", { stdin })
        const output = yield* collectStreamOutput(handle.stdout)
        const exitCode = yield* handle.exitCode

        assert.deepStrictEqual(exitCode, ChildProcessSpawner.ExitCode(0))
        assert.strictEqual(output, input)
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
  })
})
