/**
 * @since 4.0.0
 */
import * as Data from "../../data/Data.ts"

/**
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/sql/SqlError"

/**
 * @since 4.0.0
 */
export type TypeId = "~effect/sql/SqlError"

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
  readonly [TypeId]: TypeId = TypeId
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
  readonly [TypeId]: TypeId = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return `Expected ${this.expected} results but got ${this.actual}`
  }
}
