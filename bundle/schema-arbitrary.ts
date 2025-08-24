import * as Schema from "#dist/effect/schema/Schema"
import * as ToArbitrary from "#dist/effect/schema/ToArbitrary"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.Number),
  c: Schema.Array(Schema.String)
})

ToArbitrary.makeLazy(schema)
