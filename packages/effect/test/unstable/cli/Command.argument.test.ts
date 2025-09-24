import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FileSystem } from "effect/platform"
import { TestConsole } from "effect/testing"
import { Argument, Command, Flag } from "effect/unstable/cli"

const TestLayer = Layer.mergeAll(TestConsole.layer, NodeFileSystem.layer, NodePath.layer)

describe("Command arguments", () => {
  it.effect("should parse all argument types correctly", () =>
    Effect.gen(function*() {
      let result: any

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
      }, (config: any) => {
        result = config
        return Effect.void
      })

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
      let result1: any
      const existingFileCommand = Command.make("test", {
        file: Argument.file("file", { mustExist: true })
      }, ({ file }) => {
        result1 = file
        return Effect.void
      })

      yield* Command.runWithArgs(existingFileCommand, { version: "1.0.0" })([tempFile])
      assert.strictEqual(result1, tempFile)

      // Test 2: mustExist: true with non-existing file - should display error and help
      const runCommand = Command.runWithArgs(existingFileCommand, { version: "1.0.0" })
      yield* runCommand(["/non/existent/file.txt"])

      // Check that help was shown
      const stdout = yield* TestConsole.logLines
      assert.isTrue(stdout.some(line => String(line).includes("USAGE")))

      // Check that error was shown
      const stderr = yield* TestConsole.errorLines
      assert.isTrue(stderr.some(line => String(line).includes("ERROR")))
      assert.isTrue(stderr.some(line => String(line).includes("does not exist")))

      // Test 3: mustExist: false - should always pass
      let result3: any
      const optionalFileCommand = Command.make("test", {
        file: Argument.file("file", { mustExist: false })
      }, ({ file }) => {
        result3 = file
        return Effect.void
      })

      yield* Command.runWithArgs(optionalFileCommand, { version: "1.0.0" })([
        "./non-existent-file.txt"
      ])
      assert.isTrue(result3.includes("non-existent-file.txt"))
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
      assert.isTrue(stdout.some(line => String(line).includes("USAGE")))

      // Check error was shown
      const stderr = yield* TestConsole.errorLines
      assert.isTrue(stderr.some(line => String(line).includes("ERROR")))
      assert.isTrue(stderr.some(line => String(line).includes("Failed to parse integer") || (String(line).includes("parse") && String(line).includes("integer"))))
    }).pipe(Effect.provide(TestLayer)))

  it.effect("should handle variadic arguments", () =>
    Effect.gen(function*() {
      let result: any

      const testCommand = Command.make("test", {
        files: Argument.string("files").pipe(Argument.repeated)
      }, (config: any) => {
        result = config
        return Effect.void
      })

      yield* Command.runWithArgs(testCommand, { version: "1.0.0" })([
        "file1.txt",
        "file2.txt",
        "file3.txt"
      ])

      assert.deepStrictEqual(result.files, ["file1.txt", "file2.txt", "file3.txt"])
    }).pipe(Effect.provide(TestLayer)))
})
