import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect, Logger, type LogLevel, References } from "effect"
import { makeTestLogger } from "./utils/logger.ts"

type IgnoreOptions = { readonly log?: boolean | LogLevel.LogLevel }

const runIgnore = (options?: IgnoreOptions, currentLogLevel: LogLevel.LogLevel = "Info") =>
  Effect.gen(function*() {
    const { capturedLogs, testLogger } = makeTestLogger()
    const program = options === undefined
      ? Effect.fail("boom").pipe(Effect.ignore)
      : Effect.fail("boom").pipe(Effect.ignore(options))
    yield* program.pipe(
      Effect.provide(Logger.layer([testLogger])),
      Effect.provideService(References.MinimumLogLevel, "Trace"),
      Effect.provideService(References.CurrentLogLevel, currentLogLevel)
    )
    return capturedLogs
  })

const assertFailureCause = (cause: Cause.Cause<unknown>, error: unknown) => {
  assert.strictEqual(cause.failures.length, 1)
  const failure = cause.failures[0]
  assert.strictEqual(Cause.failureIsFail(failure), true)
  if (Cause.failureIsFail(failure)) {
    assert.strictEqual(failure.error, error)
  }
}

describe("Effect.ignore logging", () => {
  it.effect("does not log when log is omitted", () =>
    Effect.gen(function*() {
      const logs = yield* runIgnore()
      assert.strictEqual(logs.length, 0)
    }))

  it.effect("does not log when log is false", () =>
    Effect.gen(function*() {
      const logs = yield* runIgnore({ log: false })
      assert.strictEqual(logs.length, 0)
    }))

  it.effect("logs with the current level when log is true", () =>
    Effect.gen(function*() {
      const logs = yield* runIgnore({ log: true }, "Warn")
      assert.strictEqual(logs.length, 1)
      assert.strictEqual(logs[0].logLevel, "Warn")
      assertFailureCause(logs[0].cause, "boom")
    }))

  it.effect("logs with the provided level when log is a LogLevel", () =>
    Effect.gen(function*() {
      const logs = yield* runIgnore({ log: "Error" }, "Warn")
      assert.strictEqual(logs.length, 1)
      assert.strictEqual(logs[0].logLevel, "Error")
      assertFailureCause(logs[0].cause, "boom")
    }))
})
