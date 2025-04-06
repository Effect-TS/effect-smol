/* eslint-disable no-console */

import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const schema = Schema.Struct({
  a: Schema.NumberToString,
  b: Schema.String
}).pipe(Schema.flip, Schema.filter(() => true), Schema.flip)

console.log(schema.fields.a)

const res = SchemaParser.decodeUnknownParserResult(schema)(" 1 ")

const out = SchemaParser.catch(res, SchemaFormatter.TreeFormatter.format)

if (Result.isResult(out)) {
  if (Result.isErr(out)) {
    console.log(out.err)
  } else {
    console.log(`${typeof out.ok}:`, out.ok)
  }
} else {
  Effect.runPromise(out).then(console.log)
}
