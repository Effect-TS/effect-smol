import * as Effect from "#dist/Effect"
import * as Result from "#dist/Result"
import * as Schema from "#dist/Schema"
import * as SchemaParser from "#dist/SchemaParser"

const AsyncString = Schema.declareParserResult([])<string>()(() => (u) =>
  Effect.gen(function*() {
    yield* Effect.sleep(300)
    return yield* SchemaParser.decodeUnknownParserResult(Schema.String)(u)
  })
)

const schema = Schema.Struct({
  a: AsyncString,
  b: Schema.optional(Schema.Number),
  c: Schema.Array(Schema.String)
})

const res = SchemaParser.decodeUnknownParserResult(schema)({ a: "a", b: 1, c: ["c"] })
if (Result.isResult(res)) {
  console.log(res)
} else {
  Effect.runPromiseExit(res).then(console.log)
}
