import * as Effect from "#dist/effect/Effect"

Effect.log("hello").pipe(
  Effect.runFork
)
