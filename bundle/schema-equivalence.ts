import * as Schema from "#dist/effect/schema/Schema"
import * as ToEquivalence from "#dist/effect/schema/ToEquivalence"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.Array(Schema.String)
})

console.log(ToEquivalence.make(schema))
