import { assert, describe, it } from "@effect/vitest"
import { Config, ConfigProvider, Effect, FileSystem, Layer, Path } from "effect"
import { Argument, CliError, Flag } from "effect/unstable/cli"
import * as MockTerminal from "./services/MockTerminal.ts"

const FileSystemLayer = FileSystem.layerNoop({})
const PathLayer = Path.layer
const TerminalLayer = MockTerminal.layer

const TestLayer = Layer.mergeAll(
  FileSystemLayer,
  PathLayer,
  TerminalLayer
)

describe("Fallback config", () => {
  it.effect("uses config when a flag is missing", () => {
    const provider = ConfigProvider.fromEnv({
      env: {
        NAME: "Ava"
      }
    })

    return Effect.gen(function*() {
      const flag = Flag.string("name").pipe(
        Flag.withFallbackConfig(Config.string("NAME"))
      )

      const [, value] = yield* flag.parse({
        flags: {},
        arguments: []
      })

      assert.strictEqual(value, "Ava")
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, provider),
      Effect.provide(TestLayer)
    )
  })

  it.effect("uses flag values over config", () => {
    const provider = ConfigProvider.fromEnv({
      env: {
        NAME: "Ava"
      }
    })

    return Effect.gen(function*() {
      const flag = Flag.string("name").pipe(
        Flag.withFallbackConfig(Config.string("NAME"))
      )

      const [, value] = yield* flag.parse({
        flags: { name: ["Maya"] },
        arguments: []
      })

      assert.strictEqual(value, "Maya")
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, provider),
      Effect.provide(TestLayer)
    )
  })

  it.effect("uses config when an argument is missing", () => {
    const provider = ConfigProvider.fromEnv({
      env: {
        REPOSITORY: "repo"
      }
    })

    return Effect.gen(function*() {
      const argument = Argument.string("repository").pipe(
        Argument.withFallbackConfig(Config.string("REPOSITORY"))
      )

      const [, value] = yield* argument.parse({
        flags: {},
        arguments: []
      })

      assert.strictEqual(value, "repo")
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, provider),
      Effect.provide(TestLayer)
    )
  })

  it.effect("returns MissingOption when config is missing", () => {
    const provider = ConfigProvider.fromEnv({ env: {} })

    return Effect.gen(function*() {
      const flag = Flag.string("name").pipe(
        Flag.withFallbackConfig(Config.string("NAME"))
      )

      const error = yield* Effect.flip(
        flag.parse({
          flags: {},
          arguments: []
        })
      )

      assert.instanceOf(error, CliError.MissingOption)
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, provider),
      Effect.provide(TestLayer)
    )
  })

  it.effect("returns InvalidValue when config fails to parse", () => {
    const provider = ConfigProvider.fromEnv({
      env: {
        COUNT: "nope"
      }
    })

    return Effect.gen(function*() {
      const flag = Flag.integer("count").pipe(
        Flag.withFallbackConfig(Config.int("COUNT"))
      )

      const error = yield* Effect.flip(
        flag.parse({
          flags: {},
          arguments: []
        })
      )

      assert.instanceOf(error, CliError.InvalidValue)
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, provider),
      Effect.provide(TestLayer)
    )
  })
})
