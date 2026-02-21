import { Schema } from "effect"

const schema = Schema.Struct({
  a: Schema.optionalKey(Schema.NumberFromString)
})
