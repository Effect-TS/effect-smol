import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"

const program = Effect.gen(function*() {
  yield* Effect.logInfo("info", "message").pipe(
    Effect.annotateLogs("key", "value"),
    Effect.withLogSpan("span1"),
    Effect.withLogSpan("span2"),
    Effect.withLogger(Logger.logFmt)
  )

  yield* Effect.sleep("1 second").pipe(
    Effect.andThen(Effect.logError("error")),
    Effect.annotateLogs("key2", "value2"),
    Effect.withLogSpan("span3"),
    Effect.withLogger(Logger.prettyLoggerDefault)
  )
})

Effect.runPromise(program)
