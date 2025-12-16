import { Schema } from "effect/schema"

export class A extends Schema.Class<A>("Class")({
  a: Schema.String
}) {}
