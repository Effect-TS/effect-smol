import * as Schema from "#dist/effect/Schema"
import * as SchemaToJsonSchema from "#dist/effect/SchemaToJsonSchema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
})

SchemaToJsonSchema.make(schema)
