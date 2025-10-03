import * as Differ from "#dist/effect/schema/Differ"
import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  price: Schema.Number
})

Differ.makeJsonPatch(schema)
