import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"

const schema = Schema.String

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.runFork
)
