import * as Effect from "#dist/Effect"

Effect.succeed(123).pipe(Effect.runFork)
