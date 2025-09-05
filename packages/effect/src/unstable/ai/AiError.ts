/**
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import * as Schema from "../../schema/Schema.ts"

const TypeId = "~effect/ai/AiError" as const

/**
 * @since 4.0.0
 * @category errors
 */
export class AiError extends Schema.ErrorClass<AiError>("effect/ai/AiError")({
  _tag: Schema.tag("AiError"),
  module: Schema.String,
  method: Schema.String,
  description: Schema.String,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  static is(u: unknown): u is AiError {
    return Predicate.hasProperty(u, TypeId)
  }
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: typeof TypeId = TypeId
  /**
   * @since 4.0.0
   */
  override get message(): string {
    return `${this.module}.${this.method}: ${this.description}`
  }
}
