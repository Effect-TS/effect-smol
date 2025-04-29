import { Schema, SchemaTransformation } from "effect"

Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.trim))
Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.toLowerCase))
Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.toUpperCase))
