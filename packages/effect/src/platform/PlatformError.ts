/**
 * @since 4.0.0
 */
import * as Data from "../Data.ts"

const TypeId = "~effect/platform/PlatformError"

/**
 * @since 4.0.0
 * @category Models
 */
export class BadArgument extends Data.TaggedError("PlatformError")<{
  module: string
  method: string
  description?: string | undefined
  cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: typeof TypeId = TypeId

  /**
   * @since 4.0.0
   */
  readonly reason = "BadArgument" as const

  /**
   * @since 4.0.0
   */
  override get message(): string {
    return `${this.module}.${this.method}${this.description ? `: ${this.description}` : ""}`
  }
}

/**
 * @since 4.0.0
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
 * @since 4.0.0
 * @category models
 */
export class SystemError extends Data.TaggedError("PlatformError")<{
  reason: SystemErrorReason
  module: string
  method: string
  description?: string | undefined
  syscall?: string | undefined
  pathOrDescriptor?: string | number | undefined
  cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: typeof TypeId = TypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${
      this.pathOrDescriptor !== undefined ? ` (${this.pathOrDescriptor})` : ""
    }${this.description ? `: ${this.description}` : ""}`
  }
}

/**
 * @since 4.0.0
 * @category Models
 */
export type PlatformError = BadArgument | SystemError
