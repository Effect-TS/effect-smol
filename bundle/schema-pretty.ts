import * as Schema from "#dist/effect/schema/Schema"
import * as SchemaToPretty from "#dist/effect/schema/ToPretty"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
})

SchemaToPretty.make(schema)
