import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { assert, describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"
import { FileSystem } from "effect/platform"
import { TestConsole } from "effect/testing"
import { Argument, Command, Flag, HelpFormatter } from "effect/unstable/cli"

const TestLayer = Layer.mergeAll(
  TestConsole.layer,
  HelpFormatter.layer(HelpFormatter.defaultHelpRenderer({ colors: false })),
  NodeFileSystem.layer,
  NodePath.layer
)

describe("Command arguments", () => {
  it.effect("should parse all argument types correctly", () =>
    Effect.gen(function*() {
      // Create a Ref to store the result
      const resultRef = yield* Ref.make<any>(null)

      // Create test command with various argument types
      const testCommand = Command.make("test", {
        name: Argument.string("name"),
        count: Argument.integer("count"),
        ratio: Argument.float("ratio"),
        env: Argument.choice("env", ["dev", "prod"]),
        config: Argument.file("config", { mustExist: false }),
        workspace: Argument.directory("workspace", { mustExist: false }),
        startDate: Argument.date("start-date"),
        verbose: Flag.boolean("verbose")
      }, (config) =>
        Effect.gen(function*() {
          yield* Ref.set(resultRef, config)
        }))

      // Test parsing with valid arguments
      yield* Command.runWithArgs(testCommand, { version: "1.0.0" })([
        "myapp", // name
        "42", // count
        "3.14", // ratio
        "dev", // env
        "./config.json", // config
        "./workspace", // workspace
        "2024-01-01", // startDate
        "--verbose" // flag
      ])

      const result = yield* Ref.get(resultRef)
      assert.strictEqual(result.name, "myapp")
      assert.strictEqual(result.count, 42)
      assert.strictEqual(result.ratio, 3.14)
      assert.strictEqual(result.env, "dev")
      assert.isTrue(result.config.includes("config.json"))
      assert.isTrue(result.workspace.includes("workspace"))
      assert.deepStrictEqual(result.startDate, new Date("2024-01-01"))
      assert.strictEqual(result.verbose, true)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("should handle file mustExist validation", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem

      // Create temp file for testing
      const tempFile = yield* fs.makeTempFileScoped()
      yield* fs.writeFileString(tempFile, "test content")

      // Test 1: mustExist: true with existing file - should pass
      const result1Ref = yield* Ref.make<string | null>(null)
      const existingFileCommand = Command.make("test", {
        file: Argument.file("file", { mustExist: true })
      }, ({ file }) =>
        Effect.gen(function*() {
          yield* Ref.set(result1Ref, file)
        }))

      yield* Command.runWithArgs(existingFileCommand, { version: "1.0.0" })([tempFile])
      const result1 = yield* Ref.get(result1Ref)
      assert.strictEqual(result1, tempFile)

      // Test 2: mustExist: true with non-existing file - should display error and help
      const runCommand = Command.runWithArgs(existingFileCommand, { version: "1.0.0" })
      yield* runCommand(["/non/existent/file.txt"])

      // Check that help was shown
      const stdout = yield* TestConsole.logLines
      assert.isTrue(stdout.some((line) => String(line).includes("USAGE")))

      // Check that error was shown
      const stderr = yield* TestConsole.errorLines
      assert.isTrue(stderr.some((line) => String(line).includes("ERROR")))
      assert.isTrue(stderr.some((line) => String(line).includes("does not exist")))

      // Test 3: mustExist: false - should always pass
      const result3Ref = yield* Ref.make<string | null>(null)
      const optionalFileCommand = Command.make("test", {
        file: Argument.file("file", { mustExist: false })
      }, ({ file }) =>
        Effect.gen(function*() {
          yield* Ref.set(result3Ref, file)
        }))

      yield* Command.runWithArgs(optionalFileCommand, { version: "1.0.0" })([
        "./non-existent-file.txt"
      ])
      const result3 = yield* Ref.get(result3Ref)
      assert.isTrue(result3!.includes("non-existent-file.txt"))
    }).pipe(Effect.provide(TestLayer)))

  it.effect("should fail with invalid arguments", () =>
    Effect.gen(function*() {
      const testCommand = Command.make("test", {
        count: Argument.integer("count"),
        env: Argument.choice("env", ["dev", "prod"])
      }, (config) => Effect.succeed(config))

      // Test invalid integer - should display help and error
      const runCommand = Command.runWithArgs(testCommand, { version: "1.0.0" })
      yield* runCommand(["not-a-number", "dev"])

      // Check help was shown
      const stdout = yield* TestConsole.logLines
      const helpText = stdout.join("\n")
      expect(helpText).toMatchInlineSnapshot(`
        "USAGE
          test [flags] <count> <env>

        ARGUMENTS
          count integer    
          env choice       "
      `)

      // Check error was shown
      const stderr = yield* TestConsole.errorLines
      const errorText = stderr.join("\n")
      expect(errorText).toMatchInlineSnapshot(`
        "
        ERROR
          Invalid value for flag --count: "not-a-number". Expected: Failed to parse integer: Expected an integer, got NaN"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("should handle variadic arguments", () =>
    Effect.gen(function*() {
      const resultRef = yield* Ref.make<any>(null)

      const testCommand = Command.make("test", {
        files: Argument.string("files").pipe(Argument.repeated)
      }, (config) =>
        Effect.gen(function*() {
          yield* Ref.set(resultRef, config)
        }))

      yield* Command.runWithArgs(testCommand, { version: "1.0.0" })([
        "file1.txt",
        "file2.txt",
        "file3.txt"
      ])

      const result = yield* Ref.get(resultRef)
      assert.deepStrictEqual(result.files, ["file1.txt", "file2.txt", "file3.txt"])
    }).pipe(Effect.provide(TestLayer)))
})
