import * as Schema from "#dist/effect/schema/Schema"
import * as SchemaToFormat from "#dist/effect/schema/ToFormat"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
})

SchemaToFormat.make(schema)
