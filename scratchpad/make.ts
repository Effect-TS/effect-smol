/* eslint-disable no-console */
import { Option, Schema, SchemaFormatter } from "effect"

const schema = Schema.Struct({
  a: Schema.String.pipe(Schema.encodeToKey("b"), Schema.withConstructorDefault(Option.some("c")))
})

export const flipped = schema.pipe(Schema.flip)

export const flipped2 = schema.pipe(Schema.flip, Schema.flip)

// console.log(flipped.ast)

try {
  console.log(flipped2.makeUnsafe({}))
} catch (issue: any) {
  console.log(SchemaFormatter.TreeFormatter.format(issue))
}
