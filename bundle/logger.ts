import * as Effect from "#dist/Effect"

Effect.log("hello").pipe(
  Effect.runFork
)
