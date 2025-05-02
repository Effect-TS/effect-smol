import * as Effect from "#dist/effect/Effect"
import * as Result from "#dist/effect/Result"
import * as Schema from "#dist/effect/Schema"
import * as SchemaValidator from "#dist/effect/SchemaValidator"

const AsyncString = Schema.declareConstructor([])<string>()(() => (u) =>
  Effect.gen(function*() {
    yield* Effect.sleep(300)
    return yield* SchemaValidator.decodeUnknownSchemaResult(Schema.String)(u)
  })
)

const schema = Schema.Struct({
  a: AsyncString,
  b: Schema.optionalKey(Schema.Number),
  c: Schema.ReadonlyArray(Schema.String)
})

const res = SchemaValidator.decodeUnknownSchemaResult(schema)({ a: "a", b: 1, c: ["c"] })
if (Result.isResult(res)) {
  console.log(res)
} else {
  Effect.runPromiseExit(res).then(console.log)
}
