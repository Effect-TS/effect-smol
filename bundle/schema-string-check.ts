import * as Effect from "#dist/effect/Effect"
import * as Check from "#dist/effect/schema/Check"
import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.String.pipe(Schema.check(Check.nonEmpty()))

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.runFork
)
