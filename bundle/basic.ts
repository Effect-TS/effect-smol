import * as Effect from "#dist/effect/Effect"

Effect.succeed(123).pipe(Effect.runFork)
