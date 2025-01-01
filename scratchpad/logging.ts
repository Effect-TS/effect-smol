import * as Effect from "effect/Effect"

const program = Effect.gen(function*() {
  yield* Effect.logInfo("info").pipe(
    Effect.annotateLogs("key", "value"),
    Effect.withLogSpan("span1"),
    Effect.withLogSpan("span2")
  )

  yield* Effect.sleep("1 second").pipe(
    Effect.andThen(Effect.logError("error")),
    Effect.annotateLogs("key2", "value2"),
    Effect.withLogSpan("span3")
  )
})

Effect.runPromise(program)
