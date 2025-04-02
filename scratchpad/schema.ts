import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const schema = Schema.String

const x = Schema.asPropertySignature(schema)

// class A extends Schema.Class<A>("A")(Schema.Struct({
//   a: Schema.String
// })) {}

// export const AnnotatedA = A.annotate({})

// class B extends Schema.Class<B>("B")(A) {}

// const schema = B

// console.log(JSON.stringify(schema.ast, null, 2))

const res = SchemaParser.decodeUnknownParserResult(schema)(" 2 ")

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
