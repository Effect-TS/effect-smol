import * as Effect from "#dist/Effect"
import * as Schedule from "#dist/Schedule"

Effect.succeed(123).pipe(
  Effect.repeat({
    schedule: Schedule.spaced("100 millis")
  }),
  Effect.runFork
)
