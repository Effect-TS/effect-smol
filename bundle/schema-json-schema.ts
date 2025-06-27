import * as Schema from "#dist/effect/schema/Schema"
import * as ToJsonSchema from "#dist/effect/schema/ToJsonSchema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
})

ToJsonSchema.make(schema)
