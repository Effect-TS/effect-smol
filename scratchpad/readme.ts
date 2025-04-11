import { Schema } from "effect"

class A1 extends Schema.Class<A1>("A1")(
  Schema.Struct({
    a: Schema.String
  }).pipe(Schema.filter(({ a }) => a.length > 0))
) {}

// Alternative syntax
class A extends Schema.Class<A>("A")({
  a: Schema.String
}) {}

class A2 extends Schema.Class<A2>("B")(A.pipe(Schema.filter(({ a }) => a.length > 0))) {}
