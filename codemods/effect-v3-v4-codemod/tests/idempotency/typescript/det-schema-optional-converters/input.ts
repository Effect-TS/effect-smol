import { Schema, SchemaGetter } from "effect"

const a = Schema.optionalKey(Schema.String).pipe(Schema.decodeTo(Schema.optionalKey(Schema.Number), { decode: SchemaGetter.transformOptional(options.decode), encode: SchemaGetter.transformOptional(options.encode) }))
const b = Schema.optionalKey(Schema.String).pipe(Schema.decodeTo(Schema.Number, { decode: SchemaGetter.transformOptional(options.decode), encode: SchemaGetter.transformOptional(options.encode) }))
const c = Schema.String.pipe(Schema.decodeTo(Schema.optionalKey(Schema.Number), { decode: SchemaGetter.transformOptional(options.decode), encode: SchemaGetter.transformOptional(options.encode) }))
