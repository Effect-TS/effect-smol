import * as Schema from "#dist/effect/schema/Schema"
import * as ToEquivalence from "#dist/effect/schema/ToEquivalence"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
})

ToEquivalence.make(schema)
