import { Schema } from "effect"

const Circle = Schema.Struct({
  radius: Schema.Number
}).pipe(Schema.attachPropertySignature("kind", "circle"))
