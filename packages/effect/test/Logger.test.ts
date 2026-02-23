import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as References from "effect/References"
import * as Scope from "effect/Scope"
import * as TestConsole from "effect/testing/TestConsole"

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
        /\[\d{2}:\d{2}:\d{2}\.\d{3}\]\sINFO\s\(#1\)\sspan=\dms:/
      )
      assert.strictEqual(result[1], "info")
      assert.strictEqual(result[2], "message")
      assert.deepStrictEqual(result[3], { key: "value" })
    }))

  it.effect("annotateLogsScoped", () =>
    Effect.gen(function*() {
      const scope = yield* Scope.make()
      assert.deepStrictEqual(yield* References.CurrentLogAnnotations, {})

      yield* Effect.annotateLogsScoped("requestId", "req-1").pipe(Scope.provide(scope))
      assert.deepStrictEqual(yield* References.CurrentLogAnnotations, { requestId: "req-1" })

      yield* Scope.close(scope, Exit.void)
      assert.deepStrictEqual(yield* References.CurrentLogAnnotations, {})
    }))

  it.effect("annotateLogsScoped closes without leaking through annotateLogs", () =>
    Effect.gen(function*() {
      const scope = yield* Scope.make()

      yield* Effect.annotateLogsScoped("requestId", "req-1").pipe(Scope.provide(scope))
      yield* Scope.close(scope, Exit.void).pipe(Effect.annotateLogs("temporary", "value"))

      assert.deepStrictEqual(yield* References.CurrentLogAnnotations, {})
    }))

  it.effect(
    "replace loggers",
    Effect.fnUntraced(function*() {
      const result: Array<string> = []
      const context = yield* Layer.build(Logger.layer([Logger.formatJson.pipe(
        Logger.map((inp): void => {
          result.push(inp)
        })
      )]))
      yield* Effect.logInfo("info", "message").pipe(Effect.provideServices(context))
      assert.strictEqual(result.length, 1)
    })
  )
})
