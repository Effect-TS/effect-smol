/**
 * @since 4.0.0
 */
import * as Schema from "effect/Schema"

/**
 * A syntax or structure error found while parsing Gherkin source.
 *
 * **Details**
 *
 * The error includes the source line and column where parsing failed.
 *
 * @category errors
 * @since 4.0.0
 */
export class ParseError extends Schema.TaggedErrorClass<ParseError>()("ParseError", {
  message: Schema.String,
  line: Schema.Number,
  column: Schema.Number
}) {}

/**
 * An error raised when a parsed Gherkin step cannot be matched or decoded.
 *
 * **Details**
 *
 * The `candidates` field contains the registered step expressions considered
 * for the failing source step. When a DataTable or DocString decode fails,
 * `cause` contains the underlying Schema error.
 *
 * @category errors
 * @since 4.0.0
 */
export class MatchError extends Schema.TaggedErrorClass<MatchError>()("MatchError", {
  message: Schema.String,
  scenario: Schema.String,
  step: Schema.String,
  line: Schema.Number,
  candidates: Schema.Array(Schema.String),
  cause: Schema.optional(Schema.Unknown)
}) {}

/**
 * An error raised when a matched step implementation fails.
 *
 * **Details**
 *
 * The `cause` field preserves the original failure from the Effect returned by
 * the step implementation.
 *
 * @category errors
 * @since 4.0.0
 */
export class StepError extends Schema.TaggedErrorClass<StepError>()("StepError", {
  message: Schema.String,
  scenario: Schema.String,
  step: Schema.String,
  line: Schema.Number,
  cause: Schema.Unknown
}) {}
