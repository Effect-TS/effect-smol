import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const schema = Schema.NumberToString.pipe(Schema.filterEncoded((s) => s.length > 2))

// console.log(JSON.stringify(schema.ast, null, 2))

const res = SchemaParser.encodeUnknownParserResult(schema)(12)

const out = SchemaParser.catch(res, SchemaFormatter.TreeFormatter.format)

if (Result.isResult(out)) {
  if (Result.isErr(out)) {
    console.log(out.err)
  } else {
    console.log(out.ok)
  }
} else {
  Effect.runPromise(out).then(console.log)
}
