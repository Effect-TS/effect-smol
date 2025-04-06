/* eslint-disable no-console */

import { Effect, Option, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const schema = Schema.Option(Schema.NumberToString)

const res = SchemaParser.encodeUnknownParserResult(schema)(Option.some(123))

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
