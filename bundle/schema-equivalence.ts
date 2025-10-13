import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
})

Schema.makeEquivalence(schema)
