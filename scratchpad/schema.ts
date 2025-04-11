/* eslint-disable no-console */

import { Effect, Option, Result, Schema, SchemaAST, SchemaFormatter, SchemaParser, SchemaParserResult } from "effect"

export const asClass = <Self, S extends Schema.Top, Inherited>(c: Schema.Class<Self, S, Inherited>) => c

const schema = Schema.Struct({
  a: Schema.String.pipe(
    Schema.optional,
    Schema.encodeTo(
      Schema.optional(Schema.String),
      Schema.identity()
    )
  )
})

console.log(String(schema.ast))

export const codec = Schema.revealCodec(schema)

const res = SchemaParser.decodeUnknownParserResult(schema)({ a: "aa" })

const out = SchemaParserResult.catch(res, SchemaFormatter.TreeFormatter.format)

if (Result.isResult(out)) {
  if (Result.isErr(out)) {
    console.log(out.err)
  } else {
    console.log(`${typeof out.ok}:`, out.ok)
  }
} else {
  Effect.runPromise(out).then(console.log)
}
