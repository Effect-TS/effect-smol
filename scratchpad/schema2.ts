import { Schema } from "effect"

class A extends Schema.Class<A>("A")(Schema.Struct({
  a: Schema.String
})) {}

const B = A.pipe(Schema.filter(({ a }) => a.length > 0))

console.log(A)
console.log(B)
