import * as Schema from "#dist/effect/Schema"
import * as SchemaRepresentation from "#dist/effect/SchemaRepresentation"

const MySchema = Schema.Struct({
  foo: Schema.Literals(["a", "b"]),
  bar: Schema.BigInt.check(Schema.isGreaterThanBigInt(0n), Schema.isLessThanBigInt(10n))
})

const MySchemaAsJson = Schema.encodeSync(SchemaRepresentation.DocumentFromJson)(
  SchemaRepresentation.fromAST(MySchema.ast)
)

const roundtrip = JSON.parse(JSON.stringify(MySchemaAsJson))

export const Restored = SchemaRepresentation.toSchema(
  Schema.decodeSync(SchemaRepresentation.DocumentFromJson)(roundtrip)
)
