import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"

const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.String)

Schema.decodeUnknownEffect(schema)({}).pipe(
  Effect.runFork
)
