import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"

const schema = Schema.String

Schema.decodeUnknownEffect(schema)("a").pipe(
  Effect.runFork
)
