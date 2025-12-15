import * as Schema from "#dist/effect/schema/Schema"
import * as Standard from "#dist/effect/schema/Standard"

const MySchema = Schema.Struct({
  foo: Schema.Literals(["a", "b"]),
  bar: Schema.BigInt.check(Schema.isGreaterThanBigInt(0n), Schema.isLessThanBigInt(10n))
})

const MySchemaAsJson = Standard.toJson(Standard.fromSchema(MySchema))

const roundtrip = JSON.parse(JSON.stringify(MySchemaAsJson))

const Restored = Standard.toSchema(Standard.fromJson(roundtrip))
