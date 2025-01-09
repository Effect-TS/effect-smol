import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"

const program = Effect.gen(function*() {
  const schedule = Schedule.windowed("1 second")
  yield* Effect.log("Start")
  yield* Effect.sleep("1500 millis").pipe(
    Effect.andThen(Effect.log("Run")),
    Effect.schedule(schedule)
  )
})

Effect.runPromise(program).catch(console.log)
