import { Effect, Option, Result, Schema, SchemaFormatter, SchemaParser } from "effect"

const schema = Schema.Struct({
  a: Schema.String.pipe(
    Schema.decodeTo(
      Schema.Number.pipe(
        Schema.brand("a"),
        Schema.optional,
        Schema.mutable
      ),
      {
        encode: (n) => n.toString(),
        decode: (s) => Number(s)
      }
    )
  )
}).pipe(Schema.brand("struct"))

/*
type Type = {
    a?: number & Brand<"a">;
} & Brand<"struct">
 */
type Type = typeof schema.Type
/*
type Encoded = {
    readonly a: string;
}
    */
type Encoded = typeof schema.Encoded

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
