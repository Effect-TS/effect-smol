import * as Effect from "#dist/effect/Effect"
import * as Formatter from "#dist/effect/schema/Formatter"
import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.Struct({
  a: Schema.NonEmptyString,
  b: Schema.optional(Schema.Number),
  c: Schema.Array(Schema.String),
  d: Schema.Trim
})

Schema.decodeUnknownEffect(schema)({ a: "a", b: 1, c: ["c"] }).pipe(
  Effect.mapError((e) => Formatter.makeTree().format(e.issue)),
  Effect.runPromise
).then(console.log)
