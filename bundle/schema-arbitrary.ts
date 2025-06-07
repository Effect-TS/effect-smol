import * as Schema from "#dist/effect/Schema"
import * as SchemaToArbitrary from "#dist/effect/SchemaToArbitrary"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
})

SchemaToArbitrary.makeLazy(schema)
