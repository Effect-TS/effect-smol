/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

const TypeId = "~effect/sql/SqlError"

/**
 * @since 4.0.0
 */
export class SqlError extends Schema.TaggedErrorClass<SqlError>("effect/sql/SqlError")("SqlError", {
  cause: Schema.Defect,
  message: Schema.optional(Schema.String)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
}

/**
 * @since 4.0.0
 */
export class ResultLengthMismatch
  extends Schema.TaggedErrorClass<ResultLengthMismatch>("effect/sql/ResultLengthMismatch")("ResultLengthMismatch", {
    expected: Schema.Number,
    actual: Schema.Number
  })
{
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
