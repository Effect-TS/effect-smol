import * as Effect from "#dist/effect/Effect"
import * as Option from "#dist/effect/Option"
import * as Result from "#dist/effect/Result"
import * as Schema from "#dist/effect/Schema"
import * as SchemaParser from "#dist/effect/SchemaParser"
import * as SchemaTransformation from "#dist/effect/SchemaTransformation"

const schema = Schema.String.pipe(Schema.decodeTo(
  Schema.String,
  SchemaTransformation.transformOrFail(
    (s) =>
      Effect.gen(function*() {
        yield* Effect.sleep(300)
        return Option.some(s)
      }),
    (s) => Result.succeedSome(s)
  )
))

SchemaParser.decodeUnknown(schema)("a").pipe(Effect.runPromise).then(console.log)
