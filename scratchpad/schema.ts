import { Schema, SchemaParser } from "effect"

const Name = Schema.String.pipe(Schema.brand("name"))

const schema = Schema.Struct({
  name: Name
})

schema.make({} as any)

// // console.log(schema.ast)

// const res = SchemaParser.decodeUnknownParserResult(schema)({})

// console.log(res)
