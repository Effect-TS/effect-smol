import * as Duration from "#dist/effect/Duration"
import * as Effect from "#dist/effect/Effect"
import * as Result from "#dist/effect/Result"
import * as Schema from "#dist/effect/schema/Schema"
import * as Transformation from "#dist/effect/schema/Transformation"

const schema = Schema.String.pipe(Schema.decodeTo(
  Schema.String,
  Transformation.transformOrFail({
    decode: (s) =>
      Effect.gen(function*() {
        yield* Effect.clockWith((clock) => clock.sleep(Duration.millis(300)))
        return s
      }),
    encode: Result.succeed
  })
))

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.runFork
)
