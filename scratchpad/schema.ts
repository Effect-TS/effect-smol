import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const x = Schema.Struct({
  a: Schema.String
}).pipe(Schema.filter(({ a }) => a.length > 0))

export const xxx = x.fields
console.log(xxx)

class A extends Schema.Class<A>("A")(Schema.Struct({
  a: Schema.String
})) {}
class B extends Schema.Class<B>("B")(A) {}

const schema = B

// console.log(JSON.stringify(schema.ast, null, 2))

const res = SchemaParser.decodeUnknownParserResult(schema)({ a: "a" })

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
