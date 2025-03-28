import { Schema, SchemaParser } from "effect"

const Name = Schema.String.pipe(Schema.brand("name"), (schema) =>
  schema.annotate({
    default: schema.make("a")
  }))

const schema = Schema.Struct({
  name: Name
})

// schema.make({ name: "John" })

const res = SchemaParser.decodeUnknownParserResult(schema)({})

console.log(res)

declare const f1: <A extends string, S extends Schema.Schema<A, unknown, unknown>>(schema: S) => S
declare const f2: <S extends Schema.Schema<string, unknown, unknown>>(schema: S) => S

declare const schema1: Schema.Schema<"a", string, string>

f1(schema1)
f2(schema1)
