import { Schema } from "effect"

const schema = Schema.Union(Schema.String, Schema.Number)
