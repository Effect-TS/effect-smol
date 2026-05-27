import * as Schema from "effect/Schema"

/** @internal */
export class ParseError extends Schema.TaggedErrorClass<ParseError>()("ParseError", {
  message: Schema.String,
  line: Schema.Number,
  column: Schema.Number
}) {}

/** @internal */
export class MatchError extends Schema.TaggedErrorClass<MatchError>()("MatchError", {
  message: Schema.String,
  scenario: Schema.String,
  step: Schema.String,
  line: Schema.Number,
  candidates: Schema.Array(Schema.String)
}) {}

/** @internal */
export class StepError extends Schema.TaggedErrorClass<StepError>()("StepError", {
  message: Schema.String,
  scenario: Schema.String,
  step: Schema.String,
  line: Schema.Number,
  cause: Schema.Unknown
}) {}
