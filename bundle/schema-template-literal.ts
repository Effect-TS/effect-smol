import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"

const schema = Schema.TemplateLiteral(["a", Schema.String])

Schema.decodeUnknownEffect(schema)("abc").pipe(
  Effect.tap(console.log),
  Effect.runFork
)
