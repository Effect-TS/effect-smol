import * as Effect from "effect/Effect"
import * as TestConsole from "effect/TestConsole"
import { assert, describe, it } from "./utils/extend.js"

describe("Logger", () => {
  it.scoped("test", () =>
    Effect.gen(function*() {
      yield* TestConsole.make

      yield* Effect.logInfo("info", "message").pipe(
        Effect.annotateLogs("key", "value"),
        Effect.withLogSpan("span1"),
        Effect.withLogSpan("span2")
      )

      const result = yield* TestConsole.logLines

      assert.include(result[0], "timestamp")
      assert.include(result[0], "level=INFO")
      assert.include(result[0], "fiber=#2")
      assert.include(result[0], "span1")
      assert.include(result[0], "span2")
      assert.include(result[0], "message=info message=message")
      assert.include(result[0], "key=value")
    }))
})
