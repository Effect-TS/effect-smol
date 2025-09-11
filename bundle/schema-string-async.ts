import * as Duration from "#dist/effect/data/Duration"
import * as Effect from "#dist/effect/Effect"
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
    encode: (_) => Effect.succeed(_)
  })
))

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.runFork
)
