import { Schema } from "effect"

const Circle = Schema.Struct({
  radius: Schema.Number
}).mapFields((fields) => ({ ...fields, "kind": Schema.tagDefaultOmit("circle") }))
