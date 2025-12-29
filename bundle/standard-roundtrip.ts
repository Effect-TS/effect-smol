import * as Schema from "#dist/effect/Schema"
import * as SchemaStandard from "#dist/effect/SchemaStandard"

const MySchema = Schema.Struct({
  foo: Schema.Literals(["a", "b"]),
  bar: Schema.BigInt.check(Schema.isGreaterThanBigInt(0n), Schema.isLessThanBigInt(10n))
})

const MySchemaAsJson = SchemaStandard.toJson(SchemaStandard.fromAST(MySchema.ast))

const roundtrip = JSON.parse(JSON.stringify(MySchemaAsJson))

export const Restored = SchemaStandard.toSchema(SchemaStandard.fromJson(roundtrip))
