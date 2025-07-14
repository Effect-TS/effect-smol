/**
 * This module provides a comprehensive file system abstraction that supports both synchronous
 * and asynchronous file operations through Effect. It includes utilities for file I/O, directory
 * management, permissions, timestamps, and file watching with proper error handling.
 *
 * The `FileSystem` interface provides a cross-platform abstraction over file system operations,
 * allowing you to work with files and directories in a functional, composable way. All operations
 * return `Effect` values that can be composed, transformed, and executed safely.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Create a directory
 *   yield* fs.makeDirectory("./temp", { recursive: true })
 *
 *   // Write a file
 *   yield* fs.writeFileString("./temp/hello.txt", "Hello, World!")
 *
 *   // Read the file back
 *   const content = yield* fs.readFileString("./temp/hello.txt")
 *   yield* Console.log("File content:", content)
 *
 *   // Get file information
 *   const stats = yield* fs.stat("./temp/hello.txt")
 *   yield* Console.log("File size:", stats.size)
 *
 *   // Clean up
 *   yield* fs.remove("./temp", { recursive: true })
 * })
 * ```
 *
 * @since 4.0.0
 */
import * as Arr from "../Array.js"
import * as Brand from "../Brand.js"
import * as Data from "../Data.js"
import * as Effect from "../Effect.js"
import { pipe } from "../Function.js"
import * as Layer from "../Layer.js"
import * as Option from "../Option.js"
import * as Pull from "../Pull.js"
import type { Scope } from "../Scope.js"
import * as ServiceMap from "../ServiceMap.js"
import * as Sink from "../Sink.js"
import * as Stream from "../Stream.js"
import type { PlatformError } from "./PlatformError.js"
import { BadArgument, SystemError } from "./PlatformError.js"

/**
 * The type identifier for the FileSystem service.
 *
 * This constant is used internally for nominal typing and to distinguish
 * FileSystem instances from other objects at runtime.
 *
 * @example
 * ```ts
 * import { FileSystem } from "effect"
 *
 * // Check if an object has the FileSystem type identifier
 * const checkFileSystem = (obj: unknown) => {
 *   if (typeof obj === "object" && obj !== null && FileSystem.TypeId in obj) {
 *     // obj likely has the FileSystem structure
 *     console.log("Object has FileSystem TypeId")
 *   }
 * }
 *
 * // The TypeId is also used in service creation
 * console.log(FileSystem.TypeId) // "~effect/FileSystem"
 * ```
 *
 * @since 4.0.0
 * @category TypeId
 */
export const TypeId: TypeId = "~effect/FileSystem"

/**
 * Type-level identifier for the FileSystem service.
 *
 * This type represents the unique string literal used to identify the FileSystem
 * service type. It enables nominal typing for FileSystem implementations.
 *
 * @example
 * ```ts
 * import { FileSystem } from "effect"
 *
 * // TypeId is used in type constraints
 * type HasFileSystemTypeId<T> = T extends { readonly [FileSystem.TypeId]: FileSystem.TypeId }
 *   ? T
 *   : never
 *
 * // Example function that requires FileSystem TypeId
 * const processFileSystem = <T extends { readonly [FileSystem.TypeId]: FileSystem.TypeId }>(
 *   fs: T
 * ): void => {
 *   console.log("Processing FileSystem with TypeId:", fs[FileSystem.TypeId])
 * }
 * ```
 *
 * @since 4.0.0
 * @category TypeId
 */
export type TypeId = "~effect/FileSystem"

/**
 * Core interface for file system operations in Effect.
 *
 * The FileSystem interface provides a comprehensive set of file and directory operations
 * that work cross-platform. All operations return Effect values that can be composed,
 * transformed, and executed safely with proper error handling.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Basic file operations
 *   const exists = yield* fs.exists("./config.json")
 *   if (!exists) {
 *     yield* fs.writeFileString("./config.json", '{"env": "development"}')
 *   }
 *
 *   // Directory operations
 *   yield* fs.makeDirectory("./logs", { recursive: true })
 *
 *   // File information
 *   const stats = yield* fs.stat("./config.json")
 *   yield* Console.log(`File size: ${stats.size} bytes`)
 *
 *   // Streaming operations
 *   const content = yield* fs.readFileString("./config.json")
 *   yield* Console.log("Config:", content)
 * })
 * ```
 *
 * @since 4.0.0
 * @category model
 */
export interface FileSystem {
  readonly [TypeId]: TypeId

  /**
   * Check if a file can be accessed.
   * You can optionally specify the level of access to check for.
   */
  readonly access: (
    path: string,
    options?: AccessFileOptions
  ) => Effect.Effect<void, PlatformError>
  /**
   * Copy a file or directory from `fromPath` to `toPath`.
   *
   * Equivalent to `cp -r`.
   */
  readonly copy: (
    fromPath: string,
    toPath: string,
    options?: CopyOptions
  ) => Effect.Effect<void, PlatformError>
  /**
   * Copy a file from `fromPath` to `toPath`.
   */
  readonly copyFile: (
    fromPath: string,
    toPath: string
  ) => Effect.Effect<void, PlatformError>
  /**
   * Change the permissions of a file.
   */
  readonly chmod: (
    path: string,
    mode: number
  ) => Effect.Effect<void, PlatformError>
  /**
   * Change the owner and group of a file.
   */
  readonly chown: (
    path: string,
    uid: number,
    gid: number
  ) => Effect.Effect<void, PlatformError>
  /**
   * Check if a path exists.
   */
  readonly exists: (
    path: string
  ) => Effect.Effect<boolean, PlatformError>
  /**
   * Create a hard link from `fromPath` to `toPath`.
   */
  readonly link: (
    fromPath: string,
    toPath: string
  ) => Effect.Effect<void, PlatformError>
  /**
   * Create a directory at `path`. You can optionally specify the mode and
   * whether to recursively create nested directories.
   */
  readonly makeDirectory: (
    path: string,
    options?: MakeDirectoryOptions
  ) => Effect.Effect<void, PlatformError>
  /**
   * Create a temporary directory.
   *
   * By default the directory will be created inside the system's default
   * temporary directory, but you can specify a different location by setting
   * the `directory` option.
   *
   * You can also specify a prefix for the directory name by setting the
   * `prefix` option.
   */
  readonly makeTempDirectory: (
    options?: MakeTempDirectoryOptions
  ) => Effect.Effect<string, PlatformError>
  /**
   * Create a temporary directory inside a scope.
   *
   * Functionally equivalent to `makeTempDirectory`, but the directory will be
   * automatically deleted when the scope is closed.
   */
  readonly makeTempDirectoryScoped: (
    options?: MakeTempDirectoryOptions
  ) => Effect.Effect<string, PlatformError, Scope>
  /**
   * Create a temporary file.
   * The directory creation is functionally equivalent to `makeTempDirectory`.
   * The file name will be a randomly generated string.
   */
  readonly makeTempFile: (
    options?: MakeTempFileOptions
  ) => Effect.Effect<string, PlatformError>
  /**
   * Create a temporary file inside a scope.
   *
   * Functionally equivalent to `makeTempFile`, but the file will be
   * automatically deleted when the scope is closed.
   */
  readonly makeTempFileScoped: (
    options?: MakeTempFileOptions
  ) => Effect.Effect<string, PlatformError, Scope>
  /**
   * Open a file at `path` with the specified `options`.
   *
   * The file handle will be automatically closed when the scope is closed.
   */
  readonly open: (
    path: string,
    options?: OpenFileOptions
  ) => Effect.Effect<File, PlatformError, Scope>
  /**
   * List the contents of a directory.
   *
   * You can recursively list the contents of nested directories by setting the
   * `recursive` option.
   */
  readonly readDirectory: (
    path: string,
    options?: ReadDirectoryOptions
  ) => Effect.Effect<Array<string>, PlatformError>
  /**
   * Read the contents of a file.
   */
  readonly readFile: (
    path: string
  ) => Effect.Effect<Uint8Array, PlatformError>
  /**
   * Read the contents of a file.
   */
  readonly readFileString: (
    path: string,
    encoding?: string
  ) => Effect.Effect<string, PlatformError>
  /**
   * Read the destination of a symbolic link.
   */
  readonly readLink: (
    path: string
  ) => Effect.Effect<string, PlatformError>
  /**
   * Resolve a path to its canonicalized absolute pathname.
   */
  readonly realPath: (
    path: string
  ) => Effect.Effect<string, PlatformError>
  /**
   * Remove a file or directory.
   */
  readonly remove: (
    path: string,
    options?: RemoveOptions
  ) => Effect.Effect<void, PlatformError>
  /**
   * Rename a file or directory.
   */
  readonly rename: (
    oldPath: string,
    newPath: string
  ) => Effect.Effect<void, PlatformError>
  /**
   * Create a writable `Sink` for the specified `path`.
   */
  readonly sink: (
    path: string,
    options?: SinkOptions
  ) => Sink.Sink<void, Uint8Array, never, PlatformError>
  /**
   * Get information about a file at `path`.
   */
  readonly stat: (
    path: string
  ) => Effect.Effect<File.Info, PlatformError>
  /**
   * Create a readable `Stream` for the specified `path`.
   *
   * Changing the `bufferSize` option will change the internal buffer size of
   * the stream. It defaults to `4`.
   *
   * The `chunkSize` option will change the size of the chunks emitted by the
   * stream. It defaults to 64kb.
   *
   * Changing `offset` and `bytesToRead` will change the offset and the number
   * of bytes to read from the file.
   */
  readonly stream: (
    path: string,
    options?: StreamOptions
  ) => Stream.Stream<Uint8Array, PlatformError>
  /**
   * Create a symbolic link from `fromPath` to `toPath`.
   */
  readonly symlink: (
    fromPath: string,
    toPath: string
  ) => Effect.Effect<void, PlatformError>
  /**
   * Truncate a file to a specified length. If the `length` is not specified,
   * the file will be truncated to length `0`.
   */
  readonly truncate: (
    path: string,
    length?: SizeInput
  ) => Effect.Effect<void, PlatformError>
  /**
   * Change the file system timestamps of the file at `path`.
   */
  readonly utimes: (
    path: string,
    atime: Date | number,
    mtime: Date | number
  ) => Effect.Effect<void, PlatformError>
  /**
   * Watch a directory or file for changes
   */
  readonly watch: (path: string) => Stream.Stream<WatchEvent, PlatformError>
  /**
   * Write data to a file at `path`.
   */
  readonly writeFile: (
    path: string,
    data: Uint8Array,
    options?: WriteFileOptions
  ) => Effect.Effect<void, PlatformError>
  /**
   * Write a string to a file at `path`.
   */
  readonly writeFileString: (
    path: string,
    data: string,
    options?: WriteFileStringOptions
  ) => Effect.Effect<void, PlatformError>
}

/**
 * Represents a file size in bytes using a branded bigint.
 *
 * This type ensures type safety when working with file sizes, preventing
 * accidental mixing of regular numbers with size values. The underlying
 * bigint allows for handling very large file sizes beyond JavaScript's
 * number precision limits.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * // Create sizes using the Size constructor
 * const smallFile = FileSystem.Size(1024) // 1 KB
 * const largeFile = FileSystem.Size(BigInt("9007199254740992")) // Very large
 *
 * // Use with file operations
 * const truncateToSize = (path: string, size: FileSystem.Size) =>
 *   Effect.gen(function* () {
 *     const fs = yield* FileSystem.FileSystem
 *     return fs.truncate(path, size)
 *   })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export type Size = Brand.Branded<bigint, "Size">

/**
 * Input type for size parameters that accepts multiple numeric types.
 *
 * This union type allows file system operations to accept size values in
 * different formats for convenience, which are then normalized to the
 * branded `Size` type internally.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // All of these are valid SizeInput values
 *   yield* fs.truncate("file1.txt", 1024)        // number
 *   yield* fs.truncate("file2.txt", BigInt(2048)) // bigint
 *   yield* fs.truncate("file3.txt", FileSystem.Size(4096)) // Size
 * })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export type SizeInput = bigint | number | Size

/**
 * Creates a `Size` from various numeric input types.
 *
 * Converts numbers, bigints, or existing Size values into a properly
 * branded Size type. This function handles the conversion and ensures
 * type safety for file size operations.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * // From number
 * const size1 = FileSystem.Size(1024)
 * console.log(typeof size1) // "bigint"
 *
 * // From bigint
 * const size2 = FileSystem.Size(BigInt(2048))
 *
 * // From existing Size (identity)
 * const size3 = FileSystem.Size(size1)
 *
 * // Use in file operations
 * const readChunk = (path: string, chunkSize: number) =>
 *   Effect.gen(function* () {
 *     const fs = yield* FileSystem.FileSystem
 *     return fs.stream(path, {
 *       chunkSize: FileSystem.Size(chunkSize)
 *     })
 *   })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export const Size = (bytes: SizeInput): Size => typeof bytes === "bigint" ? bytes as Size : BigInt(bytes) as Size

/**
 * Creates a `Size` representing kilobytes (1024 bytes).
 *
 * Converts a number of kilobytes to the equivalent size in bytes.
 * Uses binary kilobytes (1024 bytes) rather than decimal (1000 bytes).
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Create a 64 KiB buffer size for streaming
 *   const bufferSize = FileSystem.KiB(64)
 *
 *   const stream = fs.stream("large-file.txt", {
 *     chunkSize: bufferSize
 *   })
 *
 *   // Truncate file to 100 KiB
 *   yield* fs.truncate("data.txt", FileSystem.KiB(100))
 * })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export const KiB = (n: number): Size => Size(n * 1024)

/**
 * Creates a `Size` representing mebibytes (1024² bytes).
 *
 * Converts a number of mebibytes to the equivalent size in bytes.
 * Uses binary mebibytes (1,048,576 bytes) rather than decimal megabytes.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Set a 10 MiB chunk size for large file operations
 *   const largeChunkSize = FileSystem.MiB(10)
 *
 *   const stream = fs.stream("video.mp4", {
 *     chunkSize: largeChunkSize
 *   })
 *
 *   // Check if file is larger than 100 MiB
 *   const stats = yield* fs.stat("archive.zip")
 *   const maxSize = FileSystem.MiB(100)
 *   if (stats.size > maxSize) {
 *     yield* Effect.log("File is very large!")
 *   }
 * })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export const MiB = (n: number): Size => Size(n * 1024 * 1024)

/**
 * Creates a `Size` representing gibibytes (1024³ bytes).
 *
 * Converts a number of gibibytes to the equivalent size in bytes.
 * Uses binary gibibytes (1,073,741,824 bytes) rather than decimal gigabytes.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Check available space before creating large files
 *   const stats = yield* fs.stat(".")
 *   const requiredSpace = FileSystem.GiB(5)
 *
 *   // Create a large temporary file
 *   const tempFile = yield* fs.makeTempFile({ prefix: "large-" })
 *   yield* fs.truncate(tempFile, FileSystem.GiB(1)) // 1 GiB file
 *
 *   yield* Console.log(`Created ${tempFile} with 1 GiB size`)
 * })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export const GiB = (n: number): Size => Size(n * 1024 * 1024 * 1024)

/**
 * Creates a `Size` representing tebibytes (1024⁴ bytes).
 *
 * Converts a number of tebibytes to the equivalent size in bytes.
 * Uses binary tebibytes (1,099,511,627,776 bytes) rather than decimal terabytes.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Check if we're dealing with very large files
 *   const stats = yield* fs.stat("database-backup.sql")
 *   const oneTiB = FileSystem.TiB(1)
 *
 *   if (stats.size > oneTiB) {
 *     yield* Console.log("This is a very large database backup!")
 *
 *     // Use larger chunk sizes for such files
 *     const stream = fs.stream("database-backup.sql", {
 *       chunkSize: FileSystem.MiB(100) // 100 MiB chunks
 *     })
 *   }
 * })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export const TiB = (n: number): Size => Size(n * 1024 * 1024 * 1024 * 1024)

const bigint1024 = BigInt(1024)
const bigintPiB = bigint1024 * bigint1024 * bigint1024 * bigint1024 * bigint1024

/**
 * Creates a `Size` representing pebibytes (1024⁵ bytes).
 *
 * Converts a number of pebibytes to the equivalent size in bytes.
 * Uses binary pebibytes (1,125,899,906,842,624 bytes) rather than decimal petabytes.
 * This function uses BigInt arithmetic to handle the very large numbers involved.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // For extremely large data processing scenarios
 *   const massiveDataset = FileSystem.PiB(2) // 2 PiB
 *
 *   // This would typically be used in enterprise/cloud scenarios
 *   yield* Console.log(`Processing ${massiveDataset} bytes of data`)
 *
 *   // Such large files would require specialized streaming
 *   const stream = fs.stream("massive-dataset.bin", {
 *     chunkSize: FileSystem.GiB(1), // 1 GiB chunks
 *     offset: FileSystem.TiB(100)   // Start from 100 TiB offset
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category sizes
 */
export const PiB = (n: number): Size => Size(BigInt(n) * bigintPiB)

/**
 * File open flags that determine how a file is opened and what operations are allowed.
 *
 * These flags correspond to standard POSIX file open modes and control the file access
 * permissions and behavior when opening files.
 *
 * - `"r"` - Read-only. File must exist.
 * - `"r+"` - Read/write. File must exist.
 * - `"w"` - Write-only. Truncates file to zero length or creates new file.
 * - `"wx"` - Like 'w' but fails if file exists.
 * - `"w+"` - Read/write. Truncates file to zero length or creates new file.
 * - `"wx+"` - Like 'w+' but fails if file exists.
 * - `"a"` - Write-only. Appends to file or creates new file.
 * - `"ax"` - Like 'a' but fails if file exists.
 * - `"a+"` - Read/write. Appends to file or creates new file.
 * - `"ax+"` - Like 'a+' but fails if file exists.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Open for reading only
 *   const readFile = yield* fs.open("data.txt", { flag: "r" })
 *
 *   // Open for writing, truncating existing content
 *   const writeFile = yield* fs.open("output.txt", { flag: "w" })
 *
 *   // Open for appending
 *   const appendFile = yield* fs.open("log.txt", { flag: "a" })
 *
 *   // Open for read/write, but fail if file doesn't exist
 *   const editFile = yield* fs.open("config.json", { flag: "r+" })
 * })
 * ```
 *
 * @since 4.0.0
 * @category model
 */
export type OpenFlag =
  | "r"
  | "r+"
  | "w"
  | "wx"
  | "w+"
  | "wx+"
  | "a"
  | "ax"
  | "a+"
  | "ax+"

/**
 * Options for checking file accessibility.
 *
 * These options control what level of access to test when using the `access` method.
 * By default, the method tests if the file exists and is readable.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Check if file exists
 *   yield* fs.access("./config.json")
 *
 *   // Check if file is readable
 *   yield* fs.access("./data.txt", { readable: true })
 *
 *   // Check if file is writable
 *   yield* fs.access("./output.log", { writable: true })
 *
 *   // Check multiple permissions
 *   yield* fs.access("./script.sh", {
 *     readable: true,
 *     writable: true
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface AccessFileOptions {
  readonly ok?: boolean
  readonly readable?: boolean
  readonly writable?: boolean
}

/**
 * Options for creating directories.
 *
 * Controls the behavior when creating new directories, including permission modes
 * and whether to create parent directories if they don't exist.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Create a single directory
 *   yield* fs.makeDirectory("./temp")
 *
 *   // Create nested directories recursively
 *   yield* fs.makeDirectory("./data/logs/app", { recursive: true })
 *
 *   // Create directory with specific permissions
 *   yield* fs.makeDirectory("./secure", {
 *     mode: 0o700, // Owner read/write/execute only
 *     recursive: false
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface MakeDirectoryOptions {
  readonly recursive?: boolean
  readonly mode?: number
}

/**
 * Options for copying files and directories.
 *
 * Controls the behavior when copying files, including whether to overwrite
 * existing files and preserve timestamp information.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Basic copy operation
 *   yield* fs.copy("./source.txt", "./destination.txt")
 *
 *   // Copy with overwrite protection
 *   yield* fs.copy("./config.json", "./backup/config.json", {
 *     overwrite: false
 *   })
 *
 *   // Copy preserving timestamps
 *   yield* fs.copy("./important.dat", "./archive/important.dat", {
 *     preserveTimestamps: true,
 *     overwrite: true
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface CopyOptions {
  readonly overwrite?: boolean
  readonly preserveTimestamps?: boolean
}

/**
 * Options for creating temporary directories.
 *
 * Controls where the temporary directory is created and what prefix to use
 * for the generated directory name.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Create temp directory in system default location
 *   const tempDir1 = yield* fs.makeTempDirectory()
 *   console.log(tempDir1) // e.g., "/tmp/tmp-1a2b3c4d5e6f"
 *
 *   // Create temp directory with custom prefix
 *   const tempDir2 = yield* fs.makeTempDirectory({ prefix: "myapp-" })
 *   console.log(tempDir2) // e.g., "/tmp/myapp-7g8h9i0j1k2l"
 *
 *   // Create temp directory in specific location
 *   const tempDir3 = yield* fs.makeTempDirectory({
 *     directory: "./workspace",
 *     prefix: "build-"
 *   })
 *   console.log(tempDir3) // e.g., "./workspace/build-3m4n5o6p7q8r"
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface MakeTempDirectoryOptions {
  readonly directory?: string
  readonly prefix?: string
}

/**
 * Options for creating temporary files.
 *
 * Similar to temporary directories, but for creating temporary files
 * with customizable location and naming prefix.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Create temp file in system default location
 *   const tempFile1 = yield* fs.makeTempFile()
 *   console.log(tempFile1) // e.g., "/tmp/tmp-1a2b3c4d5e6f.tmp"
 *
 *   // Create temp file with custom prefix
 *   const tempFile2 = yield* fs.makeTempFile({ prefix: "data-" })
 *   console.log(tempFile2) // e.g., "/tmp/data-7g8h9i0j1k2l.tmp"
 *
 *   // Create temp file in specific location
 *   const tempFile3 = yield* fs.makeTempFile({
 *     directory: "./cache",
 *     prefix: "session-"
 *   })
 *   console.log(tempFile3) // e.g., "./cache/session-3m4n5o6p7q8r.tmp"
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface MakeTempFileOptions {
  readonly directory?: string
  readonly prefix?: string
}

/**
 * Options for opening files.
 *
 * Controls how files are opened, including access modes and file permissions.
 * These options affect the behavior of file operations and access permissions.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Open file for reading only
 *   const readFile = yield* fs.open("./data.txt", { flag: "r" })
 *
 *   // Open file for writing, creating if it doesn't exist
 *   const writeFile = yield* fs.open("./output.txt", {
 *     flag: "w",
 *     mode: 0o644 // rw-r--r--
 *   })
 *
 *   // Open for append mode
 *   const appendFile = yield* fs.open("./log.txt", { flag: "a" })
 *
 *   // Open for read/write, fail if file doesn't exist
 *   const editFile = yield* fs.open("./config.json", { flag: "r+" })
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface OpenFileOptions {
  readonly flag?: OpenFlag
  readonly mode?: number
}

/**
 * Options for reading directory contents.
 *
 * Controls whether to recursively read subdirectories or just the immediate
 * contents of the specified directory.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Read immediate contents only
 *   const files = yield* fs.readDirectory("./src")
 *   yield* Console.log("Files:", files)
 *
 *   // Read all files recursively
 *   const allFiles = yield* fs.readDirectory("./src", { recursive: true })
 *   yield* Console.log("All files (recursive):", allFiles)
 *
 *   // Compare outputs
 *   yield* Console.log(`Found ${files.length} immediate items`)
 *   yield* Console.log(`Found ${allFiles.length} total items`)
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface ReadDirectoryOptions {
  readonly recursive?: boolean
}

/**
 * Options for removing files and directories.
 *
 * Controls the behavior when deleting files and directories, including
 * recursive removal and error handling for non-existent paths.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Remove a single file
 *   yield* fs.remove("./temp.txt")
 *
 *   // Remove directory and all contents
 *   yield* fs.remove("./temp-folder", { recursive: true })
 *
 *   // Remove with force (ignore if doesn't exist)
 *   yield* fs.remove("./maybe-exists.txt", { force: true })
 *
 *   // Remove directory recursively, ignoring if it doesn't exist
 *   yield* fs.remove("./cache", {
 *     recursive: true,
 *     force: true
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface RemoveOptions {
  /**
   * When `true`, you can recursively remove nested directories.
   */
  readonly recursive?: boolean
  /**
   * When `true`, exceptions will be ignored if `path` does not exist.
   */
  readonly force?: boolean
}

/**
 * Options for creating file sinks.
 *
 * These options extend the file opening options and control how the sink
 * behaves when writing data to files.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Stream } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Create a basic file sink
 *   const sink1 = fs.sink("./output.bin")
 *
 *   // Create sink with specific open flags
 *   const sink2 = fs.sink("./append.log", { flag: "a" })
 *
 *   // Create sink with custom permissions
 *   const sink3 = fs.sink("./secure.dat", {
 *     flag: "w",
 *     mode: 0o600 // rw-------
 *   })
 *
 *   // Use with a stream
 *   const data = Stream.fromIterable([1, 2, 3, 4, 5])
 *   const bytes = Stream.map(data, (n) => new Uint8Array([n]))
 *   yield* Stream.run(bytes, sink1)
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface SinkOptions extends OpenFileOptions {}

/**
 * Options for creating file streams.
 *
 * Controls reading behavior including chunk sizes, byte ranges, and offset positioning
 * for efficient streaming of file contents.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Stream, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Basic file streaming
 *   const stream1 = fs.stream("./data.txt")
 *
 *   // Stream with custom chunk size
 *   const stream2 = fs.stream("./large-file.bin", {
 *     chunkSize: FileSystem.MiB(1) // 1 MB chunks
 *   })
 *
 *   // Stream a specific range of bytes
 *   const stream3 = fs.stream("./archive.zip", {
 *     offset: FileSystem.KiB(100),     // Start at 100 KB
 *     bytesToRead: FileSystem.MiB(50), // Read 50 MB
 *     chunkSize: FileSystem.KiB(64)    // 64 KB chunks
 *   })
 *
 *   // Process stream data
 *   yield* stream1.pipe(
 *     Stream.map((chunk) => new TextDecoder().decode(chunk)),
 *     Stream.runForEach(Console.log)
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface StreamOptions {
  readonly bytesToRead?: SizeInput | undefined
  readonly chunkSize?: SizeInput | undefined
  readonly offset?: SizeInput | undefined
}

/**
 * Options for writing binary data to files.
 *
 * Controls how binary data is written to files, including file creation flags
 * and permission modes.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   const data = new Uint8Array([1, 2, 3, 4, 5])
 *
 *   // Basic write operation
 *   yield* fs.writeFile("./data.bin", data)
 *
 *   // Write with specific flags and permissions
 *   yield* fs.writeFile("./secure.bin", data, {
 *     flag: "wx", // Create new, fail if exists
 *     mode: 0o600 // rw-------
 *   })
 *
 *   // Append to existing file
 *   yield* fs.writeFile("./log.bin", data, { flag: "a" })
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface WriteFileOptions {
  readonly flag?: OpenFlag
  readonly mode?: number
}

/**
 * Options for writing string data to files.
 *
 * Controls how string data is written to files, with the same flag and permission
 * options as binary file writing.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   const content = "Hello, World!"
 *
 *   // Basic string write
 *   yield* fs.writeFileString("./hello.txt", content)
 *
 *   // Write with specific encoding and permissions
 *   yield* fs.writeFileString("./config.json", '{"debug": true}', {
 *     flag: "w",
 *     mode: 0o644 // rw-r--r--
 *   })
 *
 *   // Append log entry
 *   const timestamp = new Date().toISOString()
 *   yield* fs.writeFileString("./app.log", `${timestamp}: Started\n`, {
 *     flag: "a"
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category options
 */
export interface WriteFileStringOptions {
  readonly flag?: OpenFlag
  readonly mode?: number
}

/**
 * The service identifier for the FileSystem service.
 *
 * This key is used to provide and access the FileSystem service in the Effect context.
 * Use this to inject file system implementations or access file system operations.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * // Access the FileSystem service
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   const exists = yield* fs.exists("./data.txt")
 *   if (exists) {
 *     const content = yield* fs.readFileString("./data.txt")
 *     yield* Effect.log("File content:", content)
 *   }
 * })
 *
 * // Provide a custom FileSystem implementation
 * declare const platformImpl: Omit<FileSystem.FileSystem, "exists" | "readFileString" | "stream" | "sink" | "writeFileString">
 * const customFs = FileSystem.make(platformImpl)
 *
 * const withCustomFs = Effect.provideService(program, FileSystem.FileSystem, customFs)
 * ```
 *
 * @since 4.0.0
 * @category tag
 */
export const FileSystem: ServiceMap.Key<FileSystem, FileSystem> = ServiceMap.Key("effect/FileSystem")

/**
 * Creates a FileSystem implementation from a partial implementation.
 *
 * This function takes a partial FileSystem implementation and automatically provides
 * default implementations for `exists`, `readFileString`, `stream`, `sink`, and
 * `writeFileString` methods based on the provided core methods.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, PlatformError } from "effect"
 *
 * // This is a conceptual example - a real implementation would need proper platform-specific code
 * declare const platformFileSystem: Omit<FileSystem.FileSystem, "exists" | "readFileString" | "stream" | "sink" | "writeFileString">
 *
 * const customFileSystem = FileSystem.make(platformFileSystem)
 *
 * // The returned FileSystem will have all methods, including the derived ones:
 * // - exists: implemented using access()
 * // - readFileString: implemented using readFile() + text decoding
 * // - stream: implemented using open() and file reading
 * // - sink: implemented using open() and file writing
 * // - writeFileString: implemented using writeFile() + text encoding
 * ```
 *
 * @since 4.0.0
 * @category constructor
 */
export const make = (
  impl: Omit<FileSystem, TypeId | "exists" | "readFileString" | "stream" | "sink" | "writeFileString">
): FileSystem =>
  FileSystem.of({
    ...impl,
    [TypeId]: TypeId,
    exists: (path) =>
      pipe(
        impl.access(path),
        Effect.as(true),
        Effect.catchTag("SystemError", (e) => e.reason === "NotFound" ? Effect.succeed(false) : Effect.fail(e))
      ),
    readFileString: (path, encoding) =>
      Effect.flatMap(impl.readFile(path), (_) =>
        Effect.try({
          try: () => new TextDecoder(encoding).decode(_),
          catch: (cause) =>
            new BadArgument({
              module: "FileSystem",
              method: "readFileString",
              description: "invalid encoding",
              cause
            })
        })),
    stream: Effect.fnUntraced(function*(path, options) {
      const file = yield* impl.open(path, { flag: "r" })
      if (options?.offset) {
        yield* file.seek(options.offset, "start")
      }
      const bytesToRead = options?.bytesToRead !== undefined ? Size(options.bytesToRead) : undefined
      let totalBytesRead = BigInt(0)
      const chunkSize = Size(options?.chunkSize ?? 64 * 1024)
      return Stream.fromPull(Effect.succeed(
        Effect.flatMap(
          Effect.suspend((): Pull.Pull<Option.Option<Uint8Array>, PlatformError> => {
            if (bytesToRead !== undefined && bytesToRead <= totalBytesRead) {
              return Pull.haltVoid
            }
            const toRead = bytesToRead !== undefined && (bytesToRead - totalBytesRead) < chunkSize
              ? bytesToRead - totalBytesRead
              : chunkSize
            return file.readAlloc(toRead)
          }),
          Option.match({
            onNone: () => Pull.haltVoid,
            onSome: (buf) => {
              totalBytesRead += BigInt(buf.length)
              return Effect.succeed(Arr.of(buf))
            }
          })
        )
      ))
    }, Stream.unwrap),
    sink: (path, options) =>
      pipe(
        impl.open(path, { flag: "w", ...options }),
        Effect.map((file) => Sink.forEach((_: Uint8Array) => file.writeAll(_))),
        Sink.unwrap
      ),
    writeFileString: (path, data, options) =>
      Effect.flatMap(
        Effect.try({
          try: () => new TextEncoder().encode(data),
          catch: (cause) =>
            new BadArgument({
              module: "FileSystem",
              method: "writeFileString",
              description: "could not encode string",
              cause
            })
        }),
        (_) => impl.writeFile(path, _, options)
      )
  })

const notFound = (method: string, path: string) =>
  new SystemError({
    module: "FileSystem",
    method,
    reason: "NotFound",
    description: "No such file or directory",
    pathOrDescriptor: path
  })

/**
 * Creates a no-op FileSystem implementation for testing purposes.
 *
 * This function creates a FileSystem where most operations fail with "NotFound" errors,
 * except for operations that can be safely stubbed. You can override specific methods
 * by providing them in the `fileSystem` parameter.
 *
 * This is useful for testing scenarios where you want to control specific file system
 * behaviors without affecting the actual file system.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, PlatformError } from "effect"
 *
 * // Create a test filesystem that only allows reading specific files
 * const testFs = FileSystem.makeNoop({
 *   readFileString: (path) => {
 *     if (path === "test-config.json") {
 *       return Effect.succeed('{"test": true}')
 *     }
 *     return Effect.fail(new PlatformError.SystemError({
 *       module: "FileSystem",
 *       method: "readFileString",
 *       reason: "NotFound",
 *       description: "File not found",
 *       pathOrDescriptor: path
 *     }))
 *   },
 *   exists: (path) => Effect.succeed(path === "test-config.json")
 * })
 *
 * // Use in tests
 * const program = Effect.gen(function* () {
 *   const content = yield* testFs.readFileString("test-config.json")
 *   // Will succeed with mocked content
 * })
 *
 * // Test with the no-op filesystem
 * const testProgram = Effect.provideService(program, FileSystem.FileSystem, testFs)
 * ```
 *
 * @since 4.0.0
 * @category constructor
 */
export const makeNoop = (fileSystem: Partial<FileSystem>): FileSystem =>
  FileSystem.of({
    [TypeId]: TypeId,
    access(path) {
      return Effect.fail(notFound("access", path))
    },
    chmod(path) {
      return Effect.fail(notFound("chmod", path))
    },
    chown(path) {
      return Effect.fail(notFound("chown", path))
    },
    copy(path) {
      return Effect.fail(notFound("copy", path))
    },
    copyFile(path) {
      return Effect.fail(notFound("copyFile", path))
    },
    exists() {
      return Effect.succeed(false)
    },
    link(path) {
      return Effect.fail(notFound("link", path))
    },
    makeDirectory() {
      return Effect.die("not implemented")
    },
    makeTempDirectory() {
      return Effect.die("not implemented")
    },
    makeTempDirectoryScoped() {
      return Effect.die("not implemented")
    },
    makeTempFile() {
      return Effect.die("not implemented")
    },
    makeTempFileScoped() {
      return Effect.die("not implemented")
    },
    open(path) {
      return Effect.fail(notFound("open", path))
    },
    readDirectory(path) {
      return Effect.fail(notFound("readDirectory", path))
    },
    readFile(path) {
      return Effect.fail(notFound("readFile", path))
    },
    readFileString(path) {
      return Effect.fail(notFound("readFileString", path))
    },
    readLink(path) {
      return Effect.fail(notFound("readLink", path))
    },
    realPath(path) {
      return Effect.fail(notFound("realPath", path))
    },
    remove() {
      return Effect.void
    },
    rename(oldPath) {
      return Effect.fail(notFound("rename", oldPath))
    },
    sink(path) {
      return Sink.fail(notFound("sink", path))
    },
    stat(path) {
      return Effect.fail(notFound("stat", path))
    },
    stream(path) {
      return Stream.fail(notFound("stream", path))
    },
    symlink(fromPath) {
      return Effect.fail(notFound("symlink", fromPath))
    },
    truncate(path) {
      return Effect.fail(notFound("truncate", path))
    },
    utimes(path) {
      return Effect.fail(notFound("utimes", path))
    },
    watch(path) {
      return Stream.fail(notFound("watch", path))
    },
    writeFile(path) {
      return Effect.fail(notFound("writeFile", path))
    },
    writeFileString(path) {
      return Effect.fail(notFound("writeFileString", path))
    },
    ...fileSystem
  })

/**
 * Creates a Layer that provides a no-op FileSystem implementation for testing.
 *
 * This is a convenience function that wraps `makeNoop` in a Layer, making it easy
 * to provide the test filesystem to your Effect programs.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Layer } from "effect"
 *
 * // Create a test layer with specific behaviors
 * const testLayer = FileSystem.layerNoop({
 *   readFileString: (path) => Effect.succeed("mocked content"),
 *   exists: () => Effect.succeed(true)
 * })
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const content = yield* fs.readFileString("any-file.txt")
 *   return content
 * })
 *
 * // Provide the test layer
 * const testProgram = Effect.provide(program, testLayer)
 * ```
 *
 * @since 4.0.0
 * @category layers
 */
export const layerNoop = (fileSystem: Partial<FileSystem>): Layer.Layer<FileSystem> =>
  Layer.succeed(FileSystem, makeNoop(fileSystem))

/**
 * Unique symbol identifier for the File type.
 *
 * This symbol is used for nominal typing to distinguish File instances
 * from other objects and enable type-safe operations.
 *
 * @example
 * ```ts
 * import { FileSystem } from "effect"
 *
 * // Check if an object is a File
 * const checkFile = (obj: unknown) => {
 *   if (FileSystem.isFile(obj)) {
 *     // obj is now typed as FileSystem.File
 *     console.log("File descriptor:", obj.fd)
 *     return obj
 *   }
 *   return null
 * }
 * ```
 *
 * @since 4.0.0
 * @category type id
 */
export const FileTypeId: FileTypeId = "~effect/FileSystem/File"

/**
 * Type representing the File type identifier.
 *
 * This type is used in the File interface to provide nominal typing
 * and ensure type safety when working with File instances.
 *
 * @example
 * ```ts
 * import { FileSystem } from "effect"
 *
 * // Type guard function using FileTypeId
 * const ensureFileTypeId = <T extends { readonly [FileSystem.FileTypeId]: FileSystem.FileTypeId }>(
 *   obj: T
 * ): T => obj
 *
 * // Example usage in type constraints
 * type FileWithTypeId = {
 *   readonly [FileSystem.FileTypeId]: FileSystem.FileTypeId
 *   readonly fd: FileSystem.File.Descriptor
 * }
 * ```
 *
 * @since 4.0.0
 * @category type id
 */
export type FileTypeId = "~effect/FileSystem/File"

/**
 * Type guard to check if a value is a File instance.
 *
 * This function determines whether the provided value is a valid File
 * instance by checking for the presence of the File type identifier.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const file = yield* fs.open("data.txt", { flag: "r" })
 *
 *   if (FileSystem.isFile(file)) {
 *     // file is now typed as FileSystem.File
 *     const stats = yield* file.stat
 *     yield* Effect.log("File size:", stats.size)
 *   }
 * })
 * ```
 *
 * @since 4.0.0
 * @category guard
 */
export const isFile = (u: unknown): u is File => typeof u === "object" && u !== null && FileTypeId in u

/**
 * Interface representing an open file handle.
 *
 * Provides low-level file operations including reading, writing, seeking,
 * and retrieving file information. File handles are automatically managed
 * within scoped operations to ensure proper cleanup.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Open a file and work with the handle
 *   yield* Effect.scoped(
 *     Effect.gen(function* () {
 *       const file = yield* fs.open("./data.txt", { flag: "r+" })
 *
 *       // Get file information
 *       const stats = yield* file.stat
 *       yield* Console.log(`File size: ${stats.size} bytes`)
 *
 *       // Read from specific position
 *       yield* file.seek(10, "start")
 *       const buffer = new Uint8Array(5)
 *       const bytesRead = yield* file.read(buffer)
 *       yield* Console.log(`Read ${bytesRead} bytes:`, buffer)
 *
 *       // Write data
 *       const data = new TextEncoder().encode("Hello")
 *       yield* file.write(data)
 *       yield* file.sync // Flush to disk
 *     })
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category model
 */
export interface File {
  readonly [FileTypeId]: FileTypeId
  readonly fd: File.Descriptor
  readonly stat: Effect.Effect<File.Info, PlatformError>
  readonly seek: (offset: SizeInput, from: SeekMode) => Effect.Effect<void>
  readonly sync: Effect.Effect<void, PlatformError>
  readonly read: (buffer: Uint8Array) => Effect.Effect<Size, PlatformError>
  readonly readAlloc: (size: SizeInput) => Effect.Effect<Option.Option<Uint8Array>, PlatformError>
  readonly truncate: (length?: SizeInput) => Effect.Effect<void, PlatformError>
  readonly write: (buffer: Uint8Array) => Effect.Effect<Size, PlatformError>
  readonly writeAll: (buffer: Uint8Array) => Effect.Effect<void, PlatformError>
}

/**
 * Namespace containing types and utilities related to File operations.
 *
 * This namespace provides type definitions for file descriptors, file types,
 * and file information structures used throughout the FileSystem API.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Get file information
 *   const info: FileSystem.File.Info = yield* fs.stat("./data.txt")
 *
 *   // Inspect file type
 *   const fileType: FileSystem.File.Type = info.type
 *   yield* Console.log(`File type: ${fileType}`)
 *
 *   // Access file descriptor
 *   yield* Effect.scoped(
 *     Effect.gen(function* () {
 *       const file = yield* fs.open("./data.txt", { flag: "r" })
 *       const fd: FileSystem.File.Descriptor = file.fd
 *       yield* Console.log(`File descriptor: ${fd}`)
 *     })
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category model
 */
export declare namespace File {
  /**
   * Branded type for file descriptors.
   *
   * File descriptors are numeric handles used by the operating system
   * to identify open files. The branded type ensures type safety.
   *
   * @example
   * ```ts
   * import { FileSystem, Effect } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const fs = yield* FileSystem.FileSystem
   *
   *   yield* Effect.scoped(
   *     Effect.gen(function* () {
   *       const file = yield* fs.open("./data.txt", { flag: "r" })
   *       const descriptor: FileSystem.File.Descriptor = file.fd
   *
   *       // Use descriptor in operations
   *       console.log("Working with file descriptor:", descriptor)
   *     })
   *   )
   * })
   * ```
   *
   * @since 4.0.0
   * @category model
   */
  export type Descriptor = Brand.Branded<number, "FileDescriptor">

  /**
   * Enumeration of possible file system entry types.
   *
   * Represents the different types of entries that can exist in a file system,
   * from regular files to special device files and symbolic links.
   *
   * @example
   * ```ts
   * import { FileSystem, Effect, Console } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const fs = yield* FileSystem.FileSystem
   *
   *   const info = yield* fs.stat("./example")
   *   const fileType: FileSystem.File.Type = info.type
   *
   *   switch (fileType) {
   *     case "File":
   *       yield* Console.log("This is a regular file")
   *       break
   *     case "Directory":
   *       yield* Console.log("This is a directory")
   *       break
   *     case "SymbolicLink":
   *       yield* Console.log("This is a symbolic link")
   *       break
   *     default:
   *       yield* Console.log(`Special file type: ${fileType}`)
   *   }
   * })
   * ```
   *
   * @since 4.0.0
   * @category model
   */
  export type Type =
    | "File"
    | "Directory"
    | "SymbolicLink"
    | "BlockDevice"
    | "CharacterDevice"
    | "FIFO"
    | "Socket"
    | "Unknown"

  /**
   * Comprehensive file information structure.
   *
   * Contains metadata about a file or directory including type, timestamps,
   * permissions, and size information. This structure is returned by file
   * stat operations.
   *
   * @example
   * ```ts
   * import { FileSystem, Effect, Console, Option } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const fs = yield* FileSystem.FileSystem
   *
   *   const info: FileSystem.File.Info = yield* fs.stat("./data.txt")
   *
   *   yield* Console.log(`File type: ${info.type}`)
   *   yield* Console.log(`File size: ${info.size} bytes`)
   *   yield* Console.log(`Mode: ${info.mode.toString(8)}`) // Octal permissions
   *
   *   // Handle optional timestamps
   *   const mtime = Option.getOrElse(info.mtime, () => new Date(0))
   *   yield* Console.log(`Modified: ${mtime.toISOString()}`)
   *
   *   // Check if it's a regular file
   *   if (info.type === "File") {
   *     yield* Console.log("Processing regular file...")
   *   }
   * })
   * ```
   *
   * @since 4.0.0
   * @category model
   */
  export interface Info {
    readonly type: Type
    readonly mtime: Option.Option<Date>
    readonly atime: Option.Option<Date>
    readonly birthtime: Option.Option<Date>
    readonly dev: number
    readonly ino: Option.Option<number>
    readonly mode: number
    readonly nlink: Option.Option<number>
    readonly uid: Option.Option<number>
    readonly gid: Option.Option<number>
    readonly rdev: Option.Option<number>
    readonly size: Size
    readonly blksize: Option.Option<Size>
    readonly blocks: Option.Option<number>
  }
}

/**
 * Creates a branded file descriptor.
 *
 * File descriptors are integer handles that the operating system uses to identify
 * open files. This branded type ensures type safety when working with file descriptors.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * // File descriptors are typically obtained from file operations
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const file = yield* fs.open("data.txt", { flag: "r" })
 *
 *   // Access the file descriptor
 *   const fd: FileSystem.File.Descriptor = file.fd
 *   console.log("File descriptor:", fd)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructor
 */
export const FileDescriptor = Brand.nominal<File.Descriptor>()

/**
 * Specifies the reference point for seeking within a file.
 *
 * - `"start"` - Seek from the beginning of the file
 * - `"current"` - Seek from the current position
 *
 * @example
 * ```ts
 * import { FileSystem, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const file = yield* fs.open("data.txt", { flag: "r+" })
 *
 *   // Seek to position 100 from start
 *   yield* file.seek(100, "start")
 *
 *   // Seek forward 50 bytes from current position
 *   yield* file.seek(50, "current")
 *
 *   // Read from current position
 *   const buffer = new Uint8Array(10)
 *   yield* file.read(buffer)
 * })
 * ```
 *
 * @since 4.0.0
 * @category model
 */
export type SeekMode = "start" | "current"

/**
 * Represents file system events that can be observed when watching files or directories.
 *
 * File system watching allows you to monitor changes to files and directories in real-time.
 * This is useful for implementing features like auto-reloading, file synchronization,
 * or build systems that respond to file changes.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Console, Stream } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Watch a directory for changes
 *   const watcher = fs.watch("./src")
 *
 *   yield* watcher.pipe(
 *     Stream.take(10), // Watch for first 10 events
 *     Stream.runForEach((event) => {
 *       switch (event._tag) {
 *         case "Create":
 *           return Console.log(`File created: ${event.path}`)
 *         case "Update":
 *           return Console.log(`File updated: ${event.path}`)
 *         case "Remove":
 *           return Console.log(`File removed: ${event.path}`)
 *       }
 *     })
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category model
 */
export type WatchEvent = WatchEvent.Create | WatchEvent.Update | WatchEvent.Remove

/**
 * Namespace containing file system watch event types.
 *
 * This namespace provides type definitions for different types of file system
 * events that can be observed when watching files and directories.
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Stream, Console } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // Watch a directory for changes
 *   const watcher = fs.watch("./src")
 *
 *   yield* watcher.pipe(
 *     Stream.take(5), // Watch for first 5 events
 *     Stream.runForEach((event: FileSystem.WatchEvent) => {
 *       switch (event._tag) {
 *         case "Create":
 *           return Console.log(`Created: ${event.path}`)
 *         case "Update":
 *           return Console.log(`Updated: ${event.path}`)
 *         case "Remove":
 *           return Console.log(`Removed: ${event.path}`)
 *       }
 *     })
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category model
 */
export declare namespace WatchEvent {
  /**
   * Event representing the creation of a new file or directory.
   *
   * This event is triggered when a new file or directory is created
   * in the watched location.
   *
   * @example
   * ```ts
   * import { FileSystem } from "effect"
   *
   * // Create event structure
   * const createEvent: FileSystem.WatchEvent.Create = {
   *   _tag: "Create",
   *   path: "/path/to/new/file.txt"
   * }
   *
   * // Handle create events
   * const handleEvent = (event: FileSystem.WatchEvent) => {
   *   if (event._tag === "Create") {
   *     console.log(`New file created: ${event.path}`)
   *   }
   * }
   * ```
   *
   * @since 4.0.0
   * @category model
   */
  export interface Create {
    readonly _tag: "Create"
    readonly path: string
  }

  /**
   * Event representing the modification of an existing file or directory.
   *
   * This event is triggered when an existing file or directory is
   * modified in the watched location.
   *
   * @example
   * ```ts
   * import { FileSystem } from "effect"
   *
   * // Update event structure
   * const updateEvent: FileSystem.WatchEvent.Update = {
   *   _tag: "Update",
   *   path: "/path/to/modified/file.txt"
   * }
   *
   * // Handle update events
   * const handleEvent = (event: FileSystem.WatchEvent) => {
   *   if (event._tag === "Update") {
   *     console.log(`File modified: ${event.path}`)
   *   }
   * }
   * ```
   *
   * @since 4.0.0
   * @category model
   */
  export interface Update {
    readonly _tag: "Update"
    readonly path: string
  }

  /**
   * Event representing the deletion of a file or directory.
   *
   * This event is triggered when a file or directory is deleted
   * from the watched location.
   *
   * @example
   * ```ts
   * import { FileSystem } from "effect"
   *
   * // Remove event structure
   * const removeEvent: FileSystem.WatchEvent.Remove = {
   *   _tag: "Remove",
   *   path: "/path/to/deleted/file.txt"
   * }
   *
   * // Handle remove events
   * const handleEvent = (event: FileSystem.WatchEvent) => {
   *   if (event._tag === "Remove") {
   *     console.log(`File deleted: ${event.path}`)
   *   }
   * }
   * ```
   *
   * @since 4.0.0
   * @category model
   */
  export interface Remove {
    readonly _tag: "Remove"
    readonly path: string
  }
}

/**
 * Creates a file creation watch event.
 *
 * This constructor creates an event indicating that a new file or directory
 * has been created at the specified path.
 *
 * @example
 * ```ts
 * import { FileSystem } from "effect"
 *
 * // Create a file creation event
 * const createEvent = FileSystem.WatchEventCreate({ path: "/path/to/new/file.txt" })
 * console.log(createEvent) // { _tag: "Create", path: "/path/to/new/file.txt" }
 *
 * // Handle creation events in a watcher
 * const handleEvent = (event: FileSystem.WatchEvent) => {
 *   if (event._tag === "Create") {
 *     console.log(`File created: ${event.path}`)
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category constructor
 */
export const WatchEventCreate: Data.Case.Constructor<WatchEvent.Create, "_tag"> = Data.tagged<WatchEvent.Create>(
  "Create"
)

/**
 * Creates a file update watch event.
 *
 * This constructor creates an event indicating that an existing file
 * has been modified at the specified path.
 *
 * @example
 * ```ts
 * import { FileSystem } from "effect"
 *
 * // Create a file update event
 * const updateEvent = FileSystem.WatchEventUpdate({ path: "/path/to/modified/file.txt" })
 * console.log(updateEvent) // { _tag: "Update", path: "/path/to/modified/file.txt" }
 *
 * // Handle update events in a watcher
 * const handleEvent = (event: FileSystem.WatchEvent) => {
 *   if (event._tag === "Update") {
 *     console.log(`File modified: ${event.path}`)
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category constructor
 */
export const WatchEventUpdate: Data.Case.Constructor<WatchEvent.Update, "_tag"> = Data.tagged<WatchEvent.Update>(
  "Update"
)

/**
 * Creates a file removal watch event.
 *
 * This constructor creates an event indicating that a file or directory
 * has been deleted from the specified path.
 *
 * @example
 * ```ts
 * import { FileSystem } from "effect"
 *
 * // Create a file removal event
 * const removeEvent = FileSystem.WatchEventRemove({ path: "/path/to/deleted/file.txt" })
 * console.log(removeEvent) // { _tag: "Remove", path: "/path/to/deleted/file.txt" }
 *
 * // Handle removal events in a watcher
 * const handleEvent = (event: FileSystem.WatchEvent) => {
 *   if (event._tag === "Remove") {
 *     console.log(`File deleted: ${event.path}`)
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category constructor
 */
export const WatchEventRemove: Data.Case.Constructor<WatchEvent.Remove, "_tag"> = Data.tagged<WatchEvent.Remove>(
  "Remove"
)

/**
 * Service key for file system watch backend implementations.
 *
 * This service provides the low-level file watching capabilities that can be
 * implemented differently on various platforms (e.g., inotify on Linux,
 * FSEvents on macOS, etc.).
 *
 * @example
 * ```ts
 * import { FileSystem, Effect, Option, Stream } from "effect"
 *
 * // Custom watch backend implementation
 * const customWatchBackend = {
 *   register: (path: string, stat: FileSystem.File.Info) => {
 *     // Implementation would depend on platform
 *     return Option.some(
 *       Stream.empty // Placeholder implementation
 *     )
 *   }
 * }
 *
 * // Provide custom watch backend
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *
 *   // File watching will use the custom backend
 *   const watcher = fs.watch("./directory")
 * })
 *
 * const withCustomBackend = Effect.provideService(
 *   program,
 *   FileSystem.WatchBackend,
 *   customWatchBackend
 * )
 * ```
 *
 * @since 4.0.0
 * @category file watcher
 */
export class WatchBackend extends ServiceMap.Key<WatchBackend, {
  readonly register: (path: string, stat: File.Info) => Option.Option<Stream.Stream<WatchEvent, PlatformError>>
}>()("effect/FileSystem/WatchBackend") {}
