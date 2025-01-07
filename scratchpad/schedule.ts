import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"

const program = Effect.gen(function*() {
  const schedule = Schedule.both(
    Schedule.recurs(1),
    Schedule.recurs(2)
  )
  const step = yield* Schedule.toStep(schedule)
  for (const i of [1, 2, 3, 4]) {
    console.log(yield* step(i))
  }
})

Effect.runPromise(program).catch(console.log)
