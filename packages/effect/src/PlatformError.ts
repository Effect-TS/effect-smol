/**
 * @since 4.0.0
 */
import * as Schema from "./schema/Schema.js"

/**
 * @since 1.0.0
 * @category type id
 */
export const TypeId: unique symbol = Symbol.for("effect/PlatformError")

/**
 * @since 1.0.0
 * @category type id
 */
export type TypeId = typeof TypeId

/**
 * @since 1.0.0
 * @category Models
 */
export const Module = Schema.Literals([
  "Clipboard",
  "Command",
  "FileSystem",
  "KeyValueStore",
  "Path",
  "Stream",
  "Terminal"
])

/**
 * @since 1.0.0
 * @category Models
 */
export class BadArgument extends Schema.ErrorClass<BadArgument>("@effect/platform/Error/BadArgument")({
  _tag: Schema.tag("BadArgument"),
  module: Module,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown)
}) {
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
export const SystemErrorReason = Schema.Literals([
  "AlreadyExists",
  "BadResource",
  "Busy",
  "InvalidData",
  "NotFound",
  "PermissionDenied",
  "TimedOut",
  "UnexpectedEof",
  "Unknown",
  "WouldBlock",
  "WriteZero"
])

/**
 * @since 1.0.0
 * @category Model
 */
export type SystemErrorReason = typeof SystemErrorReason.Type

/**
 * @since 1.0.0
 * @category models
 */
export class SystemError extends Schema.ErrorClass<SystemError>("@effect/platform/Error/SystemError")({
  _tag: Schema.tag("SystemError"),
  reason: SystemErrorReason,
  module: Module,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  syscall: Schema.optional(Schema.String),
  pathOrDescriptor: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
  cause: Schema.optional(Schema.Unknown)
}) {
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

/**
 * @since 1.0.0
 * @category Models
 */
export const PlatformError: Schema.Union<[
  typeof BadArgument,
  typeof SystemError
]> = Schema.Union([BadArgument, SystemError])
