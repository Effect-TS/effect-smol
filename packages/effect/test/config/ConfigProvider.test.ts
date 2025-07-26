import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { Config, ConfigProvider } from "effect/config"
import { Redacted } from "effect/data"
import { FileSystem, Path } from "effect/platform"
import { SystemError } from "effect/platform/PlatformError"

describe("ConfigProvider", () => {
  describe("fileTree", () => {
    const provider = ConfigProvider.fileTree({ rootDirectory: "/" })
    const files: Record<string, string> = {
      "/secret": "keepitsafe\n", // test trimming
      "/SHOUTING": "value",
      "/integer": "123",
      "/nested/config": "hello"
    }
    const Fs = FileSystem.layerNoop({
      readFileString(path) {
        if (path in files) {
          return Effect.succeed(files[path])
        }
        return Effect.fail(
          new SystemError({
            module: "FileSystem",
            reason: "NotFound",
            method: "readFileString"
          })
        )
      }
    })
    const Platform = Layer.mergeAll(Fs, Path.layer)
    const SetLayer = ConfigProvider.layer(provider).pipe(
      Layer.provide(Platform),
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({
        environment: { secret: "fail" }
      })))
    )
    const AddLayer = ConfigProvider.layerAdd(provider).pipe(
      Layer.provide(Platform),
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({
        environment: {
          secret: "shh",
          fallback: "value"
        }
      })))
    )

    it.effect("reads config", () =>
      Effect.gen(function*() {
        assert.strictEqual(Redacted.value(yield* Config.Redacted("secret")), "keepitsafe")
        assert.strictEqual(yield* Config.String("SHOUTING"), "value")
        assert.strictEqual(yield* Config.Integer("integer"), 123)
        assert.strictEqual(yield* Config.String("nested/config"), "hello")
        assert.strictEqual(yield* Config.String("config").pipe(Config.nested("nested")), "hello")
        const error = yield* Effect.flip(Config.String("fallback").asEffect())
        assert.strictEqual(error.reason, "MissingData")
      }).pipe(Effect.provide(SetLayer)))

    it.effect("layerAdd uses fallback", () =>
      Effect.gen(function*() {
        assert.strictEqual(Redacted.value(yield* Config.Redacted("secret")), "shh")
        assert.strictEqual(yield* Config.Integer("integer"), 123)
        assert.strictEqual(yield* Config.String("fallback"), "value")
      }).pipe(Effect.provide(AddLayer)))
  })

  describe("dotEnv", () => {
    const Provider = ConfigProvider.layer(ConfigProvider.dotEnv()).pipe(
      Layer.provide(FileSystem.layerNoop({
        readFileString: () =>
          Effect.succeed(`SHOUTING=value
integer=123
nested_config=hello
secret=keepitsafe`)
      }))
    )

    it.effect("reads config", () =>
      Effect.gen(function*() {
        assert.strictEqual(Redacted.value(yield* Config.Redacted("secret")), "keepitsafe")
        assert.strictEqual(yield* Config.String("SHOUTING"), "value")
        assert.strictEqual(yield* Config.Integer("integer"), 123)
        assert.strictEqual(yield* Config.String("config").pipe(Config.nested("nested")), "hello")
        const error = yield* Effect.flip(Config.String("fallback").asEffect())
        assert.strictEqual(error.reason, "MissingData")
      }).pipe(Effect.provide(Provider)))
  })
})
