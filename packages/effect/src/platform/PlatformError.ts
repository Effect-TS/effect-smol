/**
 * @since 4.0.0
 */
import * as Data from "../Data.js"

/**
 * @since 1.0.0
 * @category type id
 * @example
 * ```ts
 * import { PlatformError } from "effect"
 *
 * // Used for type identification and branding
 * console.log(PlatformError.TypeId) // "~effect/PlatformError"
 *
 * // Check if an error has the PlatformError type identifier
 * const checkPlatformError = (error: unknown): error is PlatformError.PlatformError => {
 *   return typeof error === "object" && error !== null && PlatformError.TypeId in error
 * }
 * ```
 */
export const TypeId: TypeId = "~effect/PlatformError"

/**
 * @since 1.0.0
 * @category type id
 * @example
 * ```ts
 * import { PlatformError } from "effect"
 *
 * // Type representing the string literal identifier for PlatformError
 * type ErrorTypeId = PlatformError.TypeId // "~effect/PlatformError"
 *
 * // Used in type constraints and type-level operations
 * type HasPlatformErrorTypeId<T> = T extends { readonly [PlatformError.TypeId]: PlatformError.TypeId }
 *   ? T
 *   : never
 * ```
 */
export type TypeId = "~effect/PlatformError"

/**
 * @example
 * ```ts
 * import { PlatformError } from "effect"
 *
 * // Available platform modules that can report errors
 * const modules: PlatformError.Module[] = [
 *   "Clipboard",
 *   "Command",
 *   "FileSystem",
 *   "KeyValueStore",
 *   "Path",
 *   "Stream",
 *   "Terminal"
 * ]
 *
 * // Use in error creation
 * const createFileSystemError = (method: string, description: string) =>
 *   new PlatformError.BadArgument({
 *     module: "FileSystem" as PlatformError.Module,
 *     method,
 *     description
 *   })
 *
 * // Type checking for modules
 * const isValidModule = (value: string): value is PlatformError.Module =>
 *   modules.includes(value as PlatformError.Module)
 * ```
 *
 * @since 1.0.0
 * @category Models
 */
export type Module = "Clipboard" | "Command" | "FileSystem" | "KeyValueStore" | "Path" | "Stream" | "Terminal"

/**
 * @since 1.0.0
 * @category Models
 * @example
 * ```ts
 * import { PlatformError } from "effect"
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
 * import { PlatformError } from "effect"
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
 * import { PlatformError } from "effect"
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
 * import { PlatformError, Effect } from "effect"
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
