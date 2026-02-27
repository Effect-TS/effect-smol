import { assert, describe, it } from "@effect/vitest"
import { Effect, Logger, References } from "effect"
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"

describe("HttpMiddleware", () => {
  it.effect("withLoggerDisabled still disables logger after request.modify", () =>
    Effect.gen(function*() {
      const run = (disableLogger: boolean) =>
        Effect.gen(function*() {
          const logs: Array<unknown> = []
          const logger = Logger.make((options) => {
            logs.push(options)
          })
          const app = Effect.succeed(HttpServerResponse.empty()).pipe(
            disableLogger ? HttpMiddleware.withLoggerDisabled : (effect) => effect,
            Effect.updateService(HttpServerRequest.HttpServerRequest, (request) => request.modify({ url: "/rewritten" }))
          )
          yield* HttpMiddleware.logger(app).pipe(
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              HttpServerRequest.fromWeb(new Request("http://localhost:3000/prefix/secret?token=top-secret"))
            ),
            Effect.provide(Logger.layer([logger])),
            Effect.provideService(References.MinimumLogLevel, "Trace"),
            Effect.provideService(References.CurrentLogLevel, "Info")
          )
          return logs
        })

      const enabledLogs = yield* run(false)
      const disabledLogs = yield* run(true)

      assert.strictEqual(enabledLogs.length, 1)
      assert.strictEqual(disabledLogs.length, 0)
    }), 10_000)
})
