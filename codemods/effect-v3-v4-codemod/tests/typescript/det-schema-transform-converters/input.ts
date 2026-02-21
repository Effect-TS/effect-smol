import { Schema } from "effect"

const a = Schema.transform(Schema.String, Schema.Number, options)
const b = Schema.transformOrFail(Schema.String, Schema.Number, options)
