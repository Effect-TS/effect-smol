import * as Schema from "#dist/effect/schema/Schema"
import * as SchemaToPretty from "#dist/effect/schema/ToPretty"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
})

SchemaToPretty.make(schema)
