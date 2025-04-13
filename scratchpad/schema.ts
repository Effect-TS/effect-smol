/* eslint-disable no-console */

import { Effect, Result, Schema, SchemaAST, SchemaFormatter, SchemaParser, SchemaParserResult } from "effect"

export const asClass = <Self, S extends Schema.Top, Inherited>(c: Schema.Class<Self, S, Inherited>) => c

declare const extend: <NewFields extends Schema.StructNs.Fields>(
  newFields: NewFields
) => <Fields extends Schema.StructNs.Fields>(
  schema: Schema.Struct<Fields>
) => Schema.Struct<Fields & NewFields>

const schema = Schema.Struct({
  a: Schema.String
}).pipe(extend({
  b: Schema.optionalKey(Schema.String)
}))

class A extends Schema.Class<A>("A")({
  a: Schema.String
}) {}

class C extends Schema.Class<C>("C")(A) {}

class B extends Schema.Class<B>("B")(A.pipe(extend({
  b: Schema.optionalKey(Schema.String)
}))) {}

// const schema = Schema.Struct({
//   a: Schema.propertyKey({
//     optionality: "optional",
//     encodedKey: "b",
//     value: Schema.String
//   })
// })

export const codec = Schema.revealCodec(B)

const res = SchemaParser.decodeUnknownParserResult(schema)({})

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
