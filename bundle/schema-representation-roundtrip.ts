import * as Schema from "#dist/effect/Schema"
import * as SchemaRepresentation from "#dist/effect/SchemaRepresentation"

const schema = Schema.toCodecJson(Schema.Struct({
  a: Schema.String,
  b: Schema.optional(Schema.FiniteFromString),
  c: Schema.Array(Schema.String)
}))

const json = Schema.encodeSync(SchemaRepresentation.DocumentFromJson)(
  SchemaRepresentation.fromAST(schema.ast)
)

SchemaRepresentation.toSchema(
  Schema.decodeSync(SchemaRepresentation.DocumentFromJson)(JSON.parse(JSON.stringify(json)))
)
