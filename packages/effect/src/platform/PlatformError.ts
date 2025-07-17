/**
 * @since 4.0.0
 */
import * as Data from "../Data.ts"

/**
 * @since 1.0.0
 * @category type id
 */
export const TypeId: TypeId = "~effect/PlatformError"

/**
 * @since 1.0.0
 * @category type id
 */
export type TypeId = "~effect/PlatformError"

/**
 * @since 1.0.0
 * @category Models
 */
export type Module = "Clipboard" | "Command" | "FileSystem" | "KeyValueStore" | "Path" | "Stream" | "Terminal"

/**
 * @since 1.0.0
 * @category Models
 * @example
 * ```ts
 * import { PlatformError } from "effect/platform"
 *
 * // Create a BadArgument error for invalid file path
 * const invalidPathError = new PlatformError.BadArgument({
 *   module: "FileSystem",
 *   method: "readFile",
 *   description: "Path cannot be empty"
 * })
 *
 * console.log(invalidPathError.message) // "FileSystem.readFile: Path cannot be empty"
 * console.log(invalidPathError._tag) // "BadArgument"
 * console.log(invalidPathError.module) // "FileSystem"
 *
 * // Create a BadArgument error with cause
 * const errorWithCause = new PlatformError.BadArgument({
 *   module: "Path",
 *   method: "normalize",
 *   description: "Invalid path format",
 *   cause: new Error("Path contains invalid characters")
 * })
 * ```
 */
export class BadArgument extends Data.TaggedError("BadArgument")<{
  module: Module
  method: string
  description?: string | undefined
  cause?: unknown
}> {
  /**
   * @since 1.0.0
   */
  readonly [TypeId]: typeof TypeId = TypeId

  /**
   * @since 1.0.0
   */
  get message(): string {
    return `${this.module}.${this.method}${this.description ? `: ${this.description}` : ""}`
  }
}

/**
 * @since 1.0.0
 * @category Model
 * @example
 * ```ts
 * import { PlatformError } from "effect/platform"
 *
 * // Common system error reasons
 * const notFoundReason: PlatformError.SystemErrorReason = "NotFound"
 * const permissionDeniedReason: PlatformError.SystemErrorReason = "PermissionDenied"
 * const alreadyExistsReason: PlatformError.SystemErrorReason = "AlreadyExists"
 *
 * // Handle different error reasons
 * const handleSystemError = (reason: PlatformError.SystemErrorReason): string => {
 *   switch (reason) {
 *     case "NotFound":
 *       return "The requested resource was not found"
 *     case "PermissionDenied":
 *       return "Access to the resource was denied"
 *     case "AlreadyExists":
 *       return "The resource already exists"
 *     default:
 *       return "An unknown system error occurred"
 *   }
 * }
 * ```
 */
export type SystemErrorReason =
  | "AlreadyExists"
  | "BadResource"
  | "Busy"
  | "InvalidData"
  | "NotFound"
  | "PermissionDenied"
  | "TimedOut"
  | "UnexpectedEof"
  | "Unknown"
  | "WouldBlock"
  | "WriteZero"

/**
 * @example
 * ```ts
 * import { PlatformError } from "effect/platform"
 *
 * // Create a file not found system error
 * const fileNotFound = new PlatformError.SystemError({
 *   reason: "NotFound",
 *   module: "FileSystem",
 *   method: "readFile",
 *   pathOrDescriptor: "/path/to/missing/file.txt",
 *   description: "File does not exist"
 * })
 *
 * console.log(fileNotFound.message)
 * // "NotFound: FileSystem.readFile (/path/to/missing/file.txt): File does not exist"
 * console.log(fileNotFound._tag) // "SystemError"
 * console.log(fileNotFound.reason) // "NotFound"
 *
 * // Create a permission denied error with syscall info
 * const permissionError = new PlatformError.SystemError({
 *   reason: "PermissionDenied",
 *   module: "FileSystem",
 *   method: "writeFile",
 *   pathOrDescriptor: "/etc/hosts",
 *   syscall: "open",
 *   cause: new Error("EACCES: permission denied")
 * })
 *
 * // Create a timeout error for network operations
 * const timeoutError = new PlatformError.SystemError({
 *   reason: "TimedOut",
 *   module: "Stream",
 *   method: "connect",
 *   description: "Connection timed out after 30 seconds"
 * })
 * ```
 *
 * @since 1.0.0
 * @category models
 */
export class SystemError extends Data.TaggedError("SystemError")<{
  reason: SystemErrorReason
  module: Module
  method: string
  description?: string | undefined
  syscall?: string | undefined
  pathOrDescriptor?: string | number | undefined
  cause?: unknown
}> {
  /**
   * @since 1.0.0
   */
  readonly [TypeId]: typeof TypeId = TypeId

  /**
   * @since 1.0.0
   */
  get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${
      this.pathOrDescriptor !== undefined ? ` (${this.pathOrDescriptor})` : ""
    }${this.description ? `: ${this.description}` : ""}`
  }
}

/**
 * @since 1.0.0
 * @category Models
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { PlatformError } from "effect/platform"
 *
 * // PlatformError is a union of BadArgument and SystemError
 * const handlePlatformError = (error: PlatformError.PlatformError): string => {
 *   switch (error._tag) {
 *     case "BadArgument":
 *       return `Invalid argument in ${error.module}.${error.method}: ${error.description ?? "No description"}`
 *     case "SystemError":
 *       return `System error (${error.reason}) in ${error.module}.${error.method}: ${error.pathOrDescriptor ?? "No path"}`
 *   }
 * }
 *
 * // Working with Effects that might fail with PlatformError
 * const safeFileOperation = (path: string): Effect.Effect<string, PlatformError.PlatformError, never> => {
 *   if (!path) {
 *     return Effect.fail(new PlatformError.BadArgument({
 *       module: "FileSystem",
 *       method: "readFile",
 *       description: "Path cannot be empty"
 *     }))
 *   }
 *
 *   return Effect.fail(new PlatformError.SystemError({
 *     reason: "NotFound",
 *     module: "FileSystem",
 *     method: "readFile",
 *     pathOrDescriptor: path
 *   }))
 * }
 * ```
 */
export type PlatformError = BadArgument | SystemError
