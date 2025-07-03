/**
 * @since 4.0.0
 */
import * as Data from "./Data.js"

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
 */
export type PlatformError = BadArgument | SystemError
