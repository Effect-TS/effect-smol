import { Effect, Option, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const ps = Schema.String.pipe(
  Schema.optional,
  Schema.encodeOptionalToRequired(Schema.String, {
    encode: (o) => Option.getOrElse(o, () => "default"),
    decode: (s) => Option.some(s)
  })
)

const schema = Schema.Struct({
  a: ps
})

// console.log(JSON.stringify(schema.ast, null, 2))

const res = SchemaParser.encodeUnknownParserResult(schema)({})

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
