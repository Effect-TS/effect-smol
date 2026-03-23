import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as ErrorReporter from "effect/ErrorReporter"
import * as Logger from "effect/Logger"
import * as References from "effect/References"

describe("References", () => {
  it.effect(
    "logger and error reporter references are compatible",
    Effect.fnUntraced(function*() {
      assert.strictEqual(References.CurrentLoggers.key, Logger.CurrentLoggers.key)
      assert.strictEqual(References.LogToStderr.key, Logger.LogToStderr.key)
      assert.strictEqual(References.CurrentErrorReporters.key, ErrorReporter.CurrentErrorReporters.key)

      const loggers = new Set<Logger.Logger<unknown, any>>()
      const currentLoggers = yield* Effect.service(Logger.CurrentLoggers).pipe(
        Effect.provideService(References.CurrentLoggers, loggers)
      )
      assert.strictEqual(currentLoggers, loggers)

      const logToStderr = yield* Effect.service(Logger.LogToStderr).pipe(
        Effect.provideService(References.LogToStderr, true)
      )
      assert.strictEqual(logToStderr, true)

      const reporters = new Set<ErrorReporter.ErrorReporter>()
      const currentErrorReporters = yield* Effect.service(ErrorReporter.CurrentErrorReporters).pipe(
        Effect.provideService(References.CurrentErrorReporters, reporters)
      )
      assert.strictEqual(currentErrorReporters, reporters)
    })
  )
})
