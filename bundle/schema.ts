import * as Schema from "#dist/effect/Schema"
import * as SchemaParser from "#dist/effect/SchemaParser"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.ReadonlyArray(Schema.String)
})

console.log(SchemaParser.decodeUnknownSync(schema)({ a: "a", b: 1, c: ["c"] }))
