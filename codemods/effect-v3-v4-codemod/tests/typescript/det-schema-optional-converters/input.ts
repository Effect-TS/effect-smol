import { Schema } from "effect"

const a = Schema.optionalToOptional(Schema.String, Schema.Number, options)
const b = Schema.optionalToRequired(Schema.String, Schema.Number, options)
const c = Schema.requiredToOptional(Schema.String, Schema.Number, options)
