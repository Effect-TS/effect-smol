import * as Schema from "#dist/effect/schema/Schema"
import * as SchemaToShow from "#dist/effect/schema/ToShow"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
})

SchemaToShow.make(schema)
