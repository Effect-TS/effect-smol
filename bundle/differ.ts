import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  price: Schema.Number
})

Schema.makeDifferJsonPatch(schema)
