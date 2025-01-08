import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"

const program = Effect.gen(function*() {
  const schedule = Schedule.fixed("1 second")
  const step = yield* Schedule.toStep(schedule)
  for (const i of [1, 2, 3, 4]) {
    yield* step(i)
    yield* Effect.log("Step")
  }
})

Effect.runPromise(program).catch(console.log)
