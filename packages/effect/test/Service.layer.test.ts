import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Service } from "effect"

describe("Service layer helpers", () => {
  it.effect("provides service via layer", () =>
    Effect.gen(function*() {
      class Logger extends Service<Logger>()("Logger", {
        make: Effect.sync(() => ({
          info: (msg: string) => Effect.sync(() => msg)
        }))
      }) {}

      const program = Effect.gen(function*() {
        const logger = yield* Logger
        return yield* logger.info("hello")
      }).pipe(Effect.provide(Logger.layer))

      assert.strictEqual(yield* program, "hello")
    }))

  it.effect("supports deps and layerWithoutDependencies", () =>
    Effect.gen(function*() {
      class Config extends Service<Config>()("Config", {
        make: Effect.succeed({ prefix: "[cfg]" })
      }) {}

      class Logger extends Service<Logger>()("Logger", {
        make: Effect.gen(function*() {
          const cfg = yield* Config
          return {
            info: (msg: string) => Effect.sync(() => `${cfg.prefix} ${msg}`)
          }
        }),
        dependencies: [Config.layer]
      }) {}

      // Logger.layer should NOT require Config (dependencies provide it)
      const program = Effect.gen(function*() {
        const logger = yield* Logger
        return yield* logger.info("ok")
      }).pipe(Effect.provide(Logger.layer))

      assert.strictEqual(yield* program, "[cfg] ok")

      // layerWithoutDependencies requires Config (verified at type level in Service.tst.ts)
      // We can't test this at runtime because TypeScript prevents using it without Config
      // Providing Config.layer to verify it works when Config is available:
      const programWithConfig = Effect.gen(function*() {
        const logger = yield* Logger
        return yield* logger.info("ok")
      }).pipe(
        Effect.provide(Layer.provide(Logger.layerWithoutDependencies, Config.layer))
      )
      assert.strictEqual(yield* programWithConfig, "[cfg] ok")
    }))

  it.effect("factory make forwards args to layer", () =>
    Effect.gen(function*() {
      class Http extends Service<Http>()("Http", {
        make: (base: string) =>
          Effect.sync(() => ({
            url: base,
            get: (path: string) => Effect.sync(() => `${base}${path}`)
          }))
      }) {}

      const program = Effect.gen(function*() {
        const http = yield* Http
        return yield* http.get("/ping")
      }).pipe(Effect.provide(Http.layer("https://api")))

      assert.strictEqual(yield* program, "https://api/ping")
    }))

  it.effect("use lifts promise/value/effect", () =>
    Effect.gen(function*() {
      class Foo extends Service<Foo>()("Foo", {
        make: Effect.sync(() => ({
          value: 1,
          eff: () => Effect.succeed(2),
          prom: () => Promise.resolve(3)
        }))
      }) {}

      const effResult = yield* Foo.use((f) => f.eff()).pipe(Effect.provide(Foo.layer))
      const promResult = yield* Foo.use((f) => f.prom()).pipe(Effect.provide(Foo.layer))
      const valResult = yield* Foo.use((f) => f.value).pipe(Effect.provide(Foo.layer))

      assert.strictEqual(effResult, 2)
      assert.strictEqual(promResult, 3)
      assert.strictEqual(valResult, 1)
    }))

  it.effect("scoped make cleans up via Layer.effect", () =>
    Effect.gen(function*() {
      const logs: Array<string> = []

      class Scoped extends Service<Scoped>()("Scoped", {
        make: Effect.acquireRelease(
          Effect.sync(() => ({ tag: "svc" })),
          () =>
            Effect.sync(() => {
              logs.push("finalized")
            })
        )
      }) {}

      const program = Effect.gen(function*() {
        const svc = yield* Scoped
        logs.push(svc.tag)
      }).pipe(Effect.scoped, Effect.provide(Scoped.layer))

      yield* program
      assert.deepStrictEqual(logs, ["svc", "finalized"])
    }))
})
