import * as Schema from "#dist/effect/Schema"
import * as SchemaRepresentation from "#dist/effect/SchemaRepresentation"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
})

const representation = Schema.toRepresentation(schema)

SchemaRepresentation.toCodeDocument(SchemaRepresentation.toMultiDocument(representation))
