import { Schema, SchemaParser } from "effect"

const Name = Schema.String.pipe(Schema.brand("name"))

const schema = Schema.Struct({
  name: Name
})

schema.make()

// console.log(schema.ast)

const res = SchemaParser.decodeUnknownParserResult(schema)({})

console.log(res)
