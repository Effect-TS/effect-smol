import { assert, describe, it } from "@effect/vitest"
import { Config, ConfigProvider, Effect, FileSystem, Layer, Path } from "effect"
import { CliError, Command, Flag } from "effect/unstable/cli"
import { toImpl } from "effect/unstable/cli/internal/command"
import * as Lexer from "effect/unstable/cli/internal/lexer"
import * as Parser from "effect/unstable/cli/internal/parser"
import * as MockTerminal from "./services/MockTerminal.ts"

const BaseLayer = Layer.mergeAll(FileSystem.layerNoop({}), Path.layer, MockTerminal.layer)

describe("Flag.withFallbackConfig", () => {
  it.effect("uses config value when flag is missing", () =>
    Effect.gen(function*() {
      const command = Command.make("git", {
        verbose: Flag.boolean("verbose").pipe(
          Flag.withFallbackConfig(Config.boolean("VERBOSE"))
        )
      })

      const parsedInput = yield* Parser.parseArgs(Lexer.lex([]), command)
      const result = yield* toImpl(command).parse(parsedInput)

      assert.isTrue(result.verbose)
    }).pipe(Effect.provide(Layer.mergeAll(
      BaseLayer,
      ConfigProvider.layer(ConfigProvider.fromEnv({ env: { VERBOSE: "true" } }))
    ))))

  it.effect("fails when config and flag are missing", () =>
    Effect.gen(function*() {
      const command = Command.make("git", {
        verbose: Flag.boolean("verbose").pipe(
          Flag.withFallbackConfig(Config.boolean("VERBOSE"))
        )
      })

      const parsedInput = yield* Parser.parseArgs(Lexer.lex([]), command)
      const error = yield* Effect.flip(toImpl(command).parse(parsedInput))

      assert.instanceOf(error, CliError.MissingOption)
      assert.strictEqual(error.option, "verbose")
    }).pipe(Effect.provide(BaseLayer)))

  it.effect("maps config failures to InvalidValue", () =>
    Effect.gen(function*() {
      const command = Command.make("port", {
        port: Flag.integer("port").pipe(
          Flag.withFallbackConfig(Config.int("PORT"))
        )
      })

      const parsedInput = yield* Parser.parseArgs(Lexer.lex([]), command)
      const error = yield* Effect.flip(toImpl(command).parse(parsedInput))

      assert.instanceOf(error, CliError.InvalidValue)
    }).pipe(Effect.provide(Layer.mergeAll(
      BaseLayer,
      ConfigProvider.layer(ConfigProvider.fromEnv({ env: { PORT: "nope" } }))
    ))))
})
