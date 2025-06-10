import * as Schema from "#dist/effect/Schema"
import * as SchemaToEquivalence from "#dist/effect/SchemaToEquivalence"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
})

SchemaToEquivalence.make(schema)
