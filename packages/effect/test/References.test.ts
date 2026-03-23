import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as ErrorReporter from "effect/ErrorReporter"
import * as Logger from "effect/Logger"
import * as References from "effect/References"

describe("References", () => {
  it("core reference keys are compatible", () => {
    assert.strictEqual(References.CurrentLoggers.key, Logger.CurrentLoggers.key)
    assert.strictEqual(References.LogToStderr.key, Logger.LogToStderr.key)
    assert.strictEqual(References.CurrentErrorReporters.key, ErrorReporter.CurrentErrorReporters.key)
  })

  it.effect("CurrentLoggers is compatible across modules", () =>
    Effect.gen(function*() {
      const logger = Logger.make(() => {})
      const loggers = new Set([logger])

      const fromLogger = yield* Effect.service(Logger.CurrentLoggers).pipe(
        Effect.provideService(References.CurrentLoggers, loggers)
      )
      const fromReferences = yield* Effect.service(References.CurrentLoggers).pipe(
        Effect.provideService(Logger.CurrentLoggers, loggers)
      )

      assert.strictEqual(fromLogger, loggers)
      assert.strictEqual(fromReferences, loggers)
    }))

  it.effect("CurrentErrorReporters is compatible across modules", () =>
    Effect.gen(function*() {
      const reporter = ErrorReporter.make(() => {})
      const reporters = new Set([reporter])

      const fromErrorReporter = yield* Effect.service(ErrorReporter.CurrentErrorReporters).pipe(
        Effect.provideService(References.CurrentErrorReporters, reporters)
      )
      const fromReferences = yield* Effect.service(References.CurrentErrorReporters).pipe(
        Effect.provideService(ErrorReporter.CurrentErrorReporters, reporters)
      )

      assert.strictEqual(fromErrorReporter, reporters)
      assert.strictEqual(fromReferences, reporters)
    }))
})
