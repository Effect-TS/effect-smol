import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/schema/Schema"
import * as Serializer from "#dist/effect/schema/Serializer"

const schema = Serializer.stringLeafJson(Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
}))

Schema.decodeUnknownEffect(schema)({ a: "a", b: "1", c: ["c"] }).pipe(
  Effect.runFork
)
