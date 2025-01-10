import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"

const program = Effect.gen(function*() {
  const schedule = Schedule.exponential("1 second")
  yield* Effect.log("Start")
  yield* Effect.log("Run").pipe(
    Effect.schedule(schedule)
  )
})

Effect.runPromise(program).catch(console.log)
