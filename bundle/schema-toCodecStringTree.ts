import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.toCodecStringTree(Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
}))

Schema.decodeUnknownEffect(schema)({ a: "a", b: "1", c: ["c"] }).pipe(
  Effect.runFork
)
