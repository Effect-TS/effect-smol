import { Schema } from "effect"

export class A extends Schema.Opaque<A>()(Schema.URL) {
  readonly a = 1
}
