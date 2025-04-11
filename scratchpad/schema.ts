/* eslint-disable no-console */

import { Effect, Result, Schema, SchemaFormatter, SchemaParser, SchemaParserResult } from "effect"

class A extends Schema.Class<A>("A")(Schema.Struct({
  a: Schema.String
})) {}

const schema = Schema.declare({ guard: (u) => u instanceof File })

console.log({ ...A })

// export const r = Schema.asCodec(schema)

const res = SchemaParser.decodeUnknownParserResult(schema)(new File([], "a.txt"))

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
