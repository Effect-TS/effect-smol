import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.ReadonlyArray(Schema.String)
})

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.runFork
)
