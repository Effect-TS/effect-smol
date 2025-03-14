import * as Schema from "#dist/Schema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.Number),
  c: Schema.Array(Schema.String)
})

console.log(Schema.decodeUnknownEither(schema)({ a: "a", b: 1, c: ["c"] }))
