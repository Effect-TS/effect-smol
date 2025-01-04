import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as TestConsole from "effect/TestConsole"
import { assert, describe, it } from "./utils/extend.js"

describe("Logger", () => {
  it.effect("should output logs", () =>
    Effect.gen(function*() {
      yield* Effect.logInfo("info", "message").pipe(
        Effect.annotateLogs("key", "value"),
        Effect.withLogSpan("span")
      )

      const result = yield* TestConsole.logLines

      assert.match(
        result[0] as string,
        /\[\d{2}:\d{2}:\d{2}\.\d{3}\]\sINFO\s\(#2\)\sspan=\dms:/
      )
      assert.strictEqual(result[1], "info")
      assert.strictEqual(result[2], "message")
      assert.deepStrictEqual(result[3], { key: "value" })
    }))

  it.scoped(
    "replace loggers",
    Effect.fnUntraced(function*() {
      const result: Array<string> = []
      const context = yield* Layer.build(Logger.layer([Logger.formatJson.pipe(
        Logger.map((inp): void => {
          result.push(inp)
        })
      )]))
      yield* Effect.logInfo("info", "message").pipe(Effect.provideContext(context))
      assert.strictEqual(result.length, 1)
    })
  )
})
