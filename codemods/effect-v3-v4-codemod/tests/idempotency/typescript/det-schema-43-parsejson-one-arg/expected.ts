import { Schema } from "effect"

const schema = Schema.fromJsonString(Schema.Struct({ a: Schema.Number }))
