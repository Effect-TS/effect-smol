import { Effect, Either, Option } from "effect"

const program = Effect.gen(function*() {
  const a = yield* Either.right(1)
  const b = yield* Option.some(2)

  yield* Effect.log(`${a} + ${b} = ${a + b}`)
})

const withoutGen = Effect.zip(
  Either.right(1).asEffect(),
  Option.some(2).asEffect()
).pipe(
  Effect.flatMap(([a, b]) => Effect.log(`${a} + ${b} = ${a + b}`))
)

Effect.runFork(Effect.gen(function*() {
  yield* program
  yield* withoutGen
}))
