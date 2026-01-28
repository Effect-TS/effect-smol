import type { Layer } from "effect"
import { Effect, Service } from "effect"
import { describe, expect, it } from "tstyche"

describe("Service public typing", () => {
  it("layer removes requirements satisfied by dependencies", () => {
    class Config extends Service<Config>()("Config", {
      make: (prefix: string) => Effect.succeed({ prefix })
    }) {}

    class Logger extends Service<Logger>()("Logger", {
      make: Effect.gen(function*() {
        const cfg = yield* Config
        return { log: (msg: string) => Effect.succeed(`${cfg.prefix}:${msg}`) }
      }),
      dependencies: [Config.layer("cfg")]
    }) {}

    expect(Logger.layer).type.toBe<Layer.Layer<Logger>>()
    expect(Logger.layerWithoutDependencies).type.toBe<Layer.Layer<Logger, never, Config>>()
  })

  it("factory make keeps constructor parameters on layer", () => {
    class Http extends Service<Http>()("Http", {
      make: (base: string, timeout: number) =>
        Effect.succeed({
          base,
          timeout,
          get: (path: string) => Effect.succeed(`${base}${path}`)
        })
    }) {}

    expect(Http.layer).type.toBe<(base: string, timeout: number) => Layer.Layer<Http, never, never>>()
  })
})
