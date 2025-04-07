/* eslint-disable no-console */

import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

declare const S: Schema.Schema<number, string, "d", "e", "i">

const schema = Schema.Option(S)

export const r = Schema.reveal(schema)

const res = SchemaParser.decodeUnknownParserResult(schema)({})

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
