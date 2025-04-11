import * as Schema from "#dist/Schema"
import * as SchemaParser from "#dist/SchemaParser"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.Number),
  c: Schema.Array(Schema.String)
})

console.log(SchemaParser.decodeUnknownSync(schema)({ a: "a", b: 1, c: ["c"] }))
