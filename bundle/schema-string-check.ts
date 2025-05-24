import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"
import * as SchemaCheck from "#dist/effect/SchemaCheck"

const schema = Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.runFork
)
