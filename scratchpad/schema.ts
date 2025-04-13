/* eslint-disable no-console */

import { Effect, Result, Schema, SchemaFormatter, SchemaParser, SchemaParserResult } from "effect"

export const asClass = <Self, S extends Schema.Top, Inherited>(c: Schema.Class<Self, S, Inherited>) => c

const Trim = Schema.String.annotate({ title: "foo" }).pipe(Schema.decode(Schema.trim)).annotate({ title: "bar" })

const schema = Trim.pipe(Schema.decodeTo(
  Schema.NumberFromString,
  Schema.identity()
))

// console.log(String(schema.ast))

// console.dir(Schema.flip(schema).ast, { depth: null })

export const codec = Schema.revealCodec(schema)

const res = SchemaParser.encodeUnknownParserResult(schema)(2)

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
