import * as Effect from "#dist/effect/Effect"
import * as Schedule from "#dist/effect/Schedule"

Effect.succeed(123).pipe(
  Effect.repeat({
    schedule: Schedule.spaced("100 millis")
  }),
  Effect.runFork
)
