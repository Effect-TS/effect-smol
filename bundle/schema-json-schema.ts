import * as Schema from "#dist/effect/schema/Schema"
import * as ToJsonSchema from "#dist/effect/schema/ToJsonSchema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
})

ToJsonSchema.makeDraft07(schema)
