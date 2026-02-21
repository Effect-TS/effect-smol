import { Schema } from "effect"

const schema = Schema.Struct({
  a: Schema.optionalWith(Schema.NumberFromString, { exact: true })
})
