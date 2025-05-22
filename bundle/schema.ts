import * as Schema from "#dist/effect/Schema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.ReadonlyArray(Schema.String)
})

console.log(Schema.decodeUnknownSync(schema)({ a: "a", b: 1, c: ["c"] }))
