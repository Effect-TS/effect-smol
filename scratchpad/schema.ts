import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const Name = Schema.String.pipe(Schema.minLength(1), Schema.brand("name"))

const schema = Schema.Struct({
  name: Name
})

const res = SchemaParser.decodeUnknownParserResult(schema)({ name: "" })

const out = SchemaParser.catch(res, SchemaFormatter.TreeFormatter.format)

if (Result.isResult(out)) {
  console.log(out)
} else {
  Effect.runPromise(out).then(console.log)
}
