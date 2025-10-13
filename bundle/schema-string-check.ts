import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.String.check(Schema.isNonEmpty())

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.runFork
)
