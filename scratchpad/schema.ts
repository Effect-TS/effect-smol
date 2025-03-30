import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const schema = Schema.NumberFromString

const res = SchemaParser.decodeUnknownParserResult(schema)("2")

const out = SchemaParser.catch(res, SchemaFormatter.TreeFormatter.format)

if (Result.isResult(out)) {
  console.log(out)
} else {
  Effect.runPromise(out).then(console.log)
}
