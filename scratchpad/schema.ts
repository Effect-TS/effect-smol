import { Schema, SchemaParser } from "effect"

const Name = Schema.String.pipe(Schema.brand("name"))

const schema = Schema.Struct({
  name: Name
})

schema.make({ name: "John" })

const res = SchemaParser.decodeUnknownParserResult(schema)({})

console.log(res)

declare const f: <S extends Schema.Schema<{ readonly name: string }, any, any>>(schema: S) => S

f(schema)
