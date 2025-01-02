import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"
import * as TestConsole from "effect/TestConsole"
import { describe, it } from "./utils/extend.js"

describe("Logger", () => {
  it.scoped("test", () =>
    Effect.gen(function*() {
      yield* TestConsole.make

      yield* Effect.logInfo("info", "message").pipe(
        Effect.annotateLogs("key", "value"),
        Effect.withLogSpan("span1"),
        Effect.withLogSpan("span2"),
        Effect.withLogger(Logger.logFmt)
      )

      const result = yield* TestConsole.logLines

      console.log(result)
    }))
})
