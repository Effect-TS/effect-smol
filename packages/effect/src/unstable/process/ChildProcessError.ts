/**
 * A module containing typed errors which can occur when working with child
 * processes.
 *
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import type { Duration } from "../../Duration.ts"
import * as Schema from "../../schema/Schema.ts"

/**
 * @since 4.0.0
 * @category TypeId
 */
export const TypeId = "~effect/process/ChildProcessError"

/**
 * Type guard to check if a value is a ChildProcessError.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isChildProcessError = (u: unknown): u is ChildProcessError => Predicate.hasProperty(u, TypeId)

/**
 * Union type representing all possible child process error conditions.
 *
 * @since 4.0.0
 * @category Models
 */
export type ChildProcessError =
  | InvalidArgumentsError
  | SpawnError
  | ExitCodeError
  | TimeoutError
  | KilledError

/**
 * Error thrown when attempting to execute or spawn a child process with
 * invalid arguments.
 *
 * @since 4.0.0
 * @category Models
 */
export class InvalidArgumentsError extends Schema.ErrorClass<InvalidArgumentsError>(
  `${TypeId}/InvalidArgumentsError`
)({
  _tag: Schema.tag("InvalidArgumentsError"),
  message: Schema.String
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
}

/**
 * Error thrown when a child process fails to spawn.
 *
 * @since 4.0.0
 * @category Models
 */
export class SpawnError extends Schema.ErrorClass(`${TypeId}/SpawnError`)({
  _tag: Schema.tag("SpawnError"),
  executable: Schema.String,
  args: Schema.Array(Schema.String),
  cause: Schema.Defect
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    const cmdStr = [this.executable, ...this.args].join(" ")
    const causeMsg = this.cause instanceof Error ? this.cause.message : String(this.cause)
    return `Failed to spawn process "${cmdStr}": ${causeMsg}`
  }
}

/**
 * Error thrown when a child process exits with a non-zero exit code.
 *
 * @since 4.0.0
 * @category Models
 */
export class ExitCodeError extends Schema.ErrorClass(`${TypeId}/ExitCodeError`)({
  _tag: Schema.tag("ExitCodeError"),
  executable: Schema.String,
  args: Schema.Array(Schema.String),
  exitCode: Schema.Number,
  stdout: Schema.Union([Schema.String, Schema.Uint8Array]),
  stderr: Schema.Union([Schema.String, Schema.Uint8Array])
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    const cmdStr = [this.executable, ...this.args].join(" ")
    const stderrStr = typeof this.stderr === "string"
      ? this.stderr
      : new TextDecoder().decode(this.stderr as Uint8Array)
    const stderrMsg = stderrStr.trim() ? `\n${stderrStr.trim()}` : ""
    return `Process "${cmdStr}" exited with code ${this.exitCode}${stderrMsg}`
  }
}

/**
 * Error thrown when a child process times out.
 *
 * @since 4.0.0
 * @category Models
 */
export class TimeoutError extends Schema.ErrorClass(`${TypeId}/TimeoutError`)({
  _tag: Schema.tag("TimeoutError"),
  executable: Schema.String,
  args: Schema.Array(Schema.String),
  timeout: Schema.Duration
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  readonly duration: Duration = this.timeout

  /**
   * @since 4.0.0
   */
  override get message(): string {
    const cmdStr = [this.executable, ...this.args].join(" ")
    return `Process "${cmdStr}" timed out`
  }
}

/**
 * Error thrown when a child process is killed by a signal.
 *
 * @since 4.0.0
 * @category Models
 */
export class KillError extends Schema.ErrorClass(`${TypeId}/KillError`)({
  _tag: Schema.tag("KillError"),
  executable: Schema.String,
  args: Schema.Array(Schema.String),
  signal: Schema.String
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    const cmdStr = [this.executable, ...this.args].join(" ")
    return `Process "${cmdStr}" was killed by signal ${this.signal}`
  }
}
