import { Schema, SchemaTransformation } from "effect"

const a = Schema.String.pipe(Schema.decodeTo(Schema.Number, SchemaTransformation.transform({ decode: options.decode, encode: options.encode })))
const b = Schema.String.pipe(Schema.decodeTo(Schema.Number, SchemaTransformation.transformOrFail({ decode: options.decode, encode: options.encode })))
