/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"

const TypeId = "~effect/sql/SqlError"

/**
 * @since 4.0.0
 */
export class SqlError extends Data.TaggedError("SqlError")<{
  cause: unknown
  message?: string
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
}

/**
 * @since 4.0.0
 */
export class ResultLengthMismatch extends Data.TaggedError("ResultLengthMismatch")<{
  readonly expected: number
  readonly actual: number
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return `Expected ${this.expected} results but got ${this.actual}`
  }
}
