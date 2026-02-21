import { Schema } from "effect"

const schema = Schema.parseJson(Schema.Struct({ a: Schema.Number }))
