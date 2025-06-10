import * as Schema from "#dist/effect/Schema"
import * as SchemaToPretty from "#dist/effect/SchemaToPretty"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
})

SchemaToPretty.make(schema)
