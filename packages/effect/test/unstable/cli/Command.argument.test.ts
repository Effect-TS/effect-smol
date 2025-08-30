import { assert, describe, it } from "@effect/vitest"
import * as Effect from "../../../src/Effect.js"
import * as Layer from "../../../src/Layer.js"
import * as FileSystem from "../../../src/platform/FileSystem.js"
import * as Path from "../../../src/platform/Path.js"
import * as Argument from "../../../src/unstable/cli/Argument.js"
import * as Command from "../../../src/unstable/cli/Command.js"
import * as Flag from "../../../src/unstable/cli/Flag.js"

// Create mock implementations for testing
const MockFileSystem = Layer.succeed(FileSystem.FileSystem, FileSystem.make({
  access: () => Effect.succeed(),
  copy: () => Effect.succeed(),
  copyFile: () => Effect.succeed(),
  chmod: () => Effect.succeed(),
  chown: () => Effect.succeed(),
  exists: () => Effect.succeed(true),
  link: () => Effect.succeed(),
  makeDirectory: () => Effect.succeed(),
  makeTempDirectory: () => Effect.succeed("/tmp/test"),
  makeTempDirectoryScoped: () => Effect.succeed("/tmp/test"),
  makeTempFile: () => Effect.succeed("/tmp/test.txt"),
  makeTempFileScoped: () => Effect.succeed("/tmp/test.txt"),
  open: () => Effect.succeed({} as any),
  readDirectory: () => Effect.succeed([]),
  readFile: () => Effect.succeed(new Uint8Array()),
  readFileString: () => Effect.succeed(""),
  readLink: () => Effect.succeed(""),
  realPath: (path: string) => Effect.succeed(path),
  remove: () => Effect.succeed(),
  rename: () => Effect.succeed(),
  sink: () => Effect.succeed({} as any),
  stat: () => Effect.succeed({} as any),
  stream: () => Effect.succeed({} as any),
  symlink: () => Effect.succeed(),
  truncate: () => Effect.succeed(),
  utimes: () => Effect.succeed(),
  watch: () => Effect.succeed({} as any),
  writeFile: () => Effect.succeed(),
  writeFileString: () => Effect.succeed()
}))

const MockPath = Layer.succeed(Path.Path, Path.make({
  basename: (path: string) => path.split("/").pop() || "",
  dirname: (path: string) => path.split("/").slice(0, -1).join("/") || "/",
  extname: (path: string) => {
    const parts = path.split(".")
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : ""
  },
  format: ({ dir, name, ext }) => `${dir}/${name}${ext || ""}`,
  fromFileUrl: (url: URL) => url.pathname,
  isAbsolute: (path: string) => path.startsWith("/"),
  join: (...paths: string[]) => paths.join("/"),
  normalize: (path: string) => path,
  parse: (path: string) => ({
    dir: path.split("/").slice(0, -1).join("/") || "/",
    name: path.split("/").pop()?.split(".").slice(0, -1).join(".") || "",
    ext: path.split(".").pop() || "",
    base: path.split("/").pop() || "",
    root: "/"
  }),
  relative: (from: string, to: string) => to,
  resolve: (...paths: string[]) => paths.join("/"),
  sep: "/",
  toFileUrl: (path: string) => new URL(`file://${path}`)
}))

const TestLayer = Layer.mergeAll(MockFileSystem, MockPath)

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
      yield* Command.run(testCommand, { name: "test", version: "1.0.0" })([
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
      const existingFileCommand = Command.make("test", {
        file: Argument.file("file", { mustExist: true })
      }, ({ file }) => {
        assert.strictEqual(file, tempFile)
        return Effect.void
      })

      yield* Command.run(existingFileCommand, { name: "test", version: "1.0.0" })([tempFile])

      // Test 2: mustExist: true with non-existing file - should fail
      const error = yield* Effect.flip(
        Command.run(existingFileCommand, { name: "test", version: "1.0.0" })(["/non/existent/file.txt"])
      )
      assert.isTrue(String(error).includes("does not exist"))

      // Test 3: mustExist: false - should always pass
      const optionalFileCommand = Command.make("test", {
        file: Argument.file("file", { mustExist: false })
      }, ({ file }) => {
        assert.isTrue(file.includes("non-existent-file.txt"))
        return Effect.void
      })

      yield* Command.run(optionalFileCommand, { name: "test", version: "1.0.0" })([
        "./non-existent-file.txt"
      ])
    }).pipe(Effect.provide(TestLayer)))

  it.effect("should fail with invalid arguments", () =>
    Effect.gen(function*() {
      const testCommand = Command.make("test", {
        count: Argument.integer("count"),
        env: Argument.choice("env", ["dev", "prod"])
      }, (config) => Effect.succeed(config))

      // Test invalid integer
      const error1 = yield* Effect.flip(
        Command.run(testCommand, { name: "test", version: "1.0.0" })(["not-a-number", "dev"])
      )
      assert.isTrue(String(error1).includes("Failed to parse integer"))

      // Test invalid choice
      const error2 = yield* Effect.flip(
        Command.run(testCommand, { name: "test", version: "1.0.0" })(["42", "invalid"])
      )
      assert.isTrue(String(error2).includes("Expected one of: dev, prod"))
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

      yield* Command.run(testCommand, { name: "test", version: "1.0.0" })([
        "file1.txt",
        "file2.txt",
        "file3.txt"
      ])

      assert.deepStrictEqual(result.files, ["file1.txt", "file2.txt", "file3.txt"])
    }).pipe(Effect.provide(TestLayer)))
})
