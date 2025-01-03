import * as Effect from "effect/Effect"
import * as TestConsole from "effect/TestConsole"
import { assert, describe, it } from "./utils/extend.js"

describe("Logger", () => {
  it.scoped("test", () =>
    Effect.gen(function*() {
      yield* TestConsole.make

      yield* Effect.logInfo("info", "message").pipe(
        Effect.annotateLogs("key", "value"),
        Effect.withLogSpan("span")
      )

      const result = yield* TestConsole.logLines

      assert.match(
        result[0] as string,
        /\[\d{2}:\d{2}:\d{2}\.\d{3}\] INFO \(#2\) span=\dms: info/
      )
      assert.strictEqual(result[1], "message")
      assert.strictEqual(result[2], "key:")
      assert.strictEqual(result[3], "value")
    }))
})
