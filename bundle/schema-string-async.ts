import * as Duration from "#dist/effect/Duration"
import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"
import * as SchemaTransformation from "#dist/effect/SchemaTransformation"

const schema = Schema.String.pipe(Schema.decodeTo(
  Schema.String,
  SchemaTransformation.transformOrFail({
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
