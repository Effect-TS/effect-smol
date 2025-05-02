import * as Schema from "#dist/effect/Schema"
import * as SchemaValidator from "#dist/effect/SchemaValidator"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.ReadonlyArray(Schema.String)
})

console.log(SchemaValidator.decodeUnknownSync(schema)({ a: "a", b: 1, c: ["c"] }))
