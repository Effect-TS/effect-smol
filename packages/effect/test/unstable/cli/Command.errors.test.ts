import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FileSystem, Path } from "effect/platform"
import { CliError, Command, Flag } from "effect/unstable/cli"
import * as Lexer from "effect/unstable/cli/internal/lexer"
import * as Parser from "effect/unstable/cli/internal/parser"

const TestLayer = Layer.mergeAll(FileSystem.layerNoop({}), Path.layer)

describe("Command errors", () => {
  describe("parse", () => {
    it.effect("fails with MissingOption when a required flag is absent", () =>
      Effect.gen(function*() {
        const command = Command.make("needs-value", {
          value: Flag.string("value")
        })

        const parsedInput = yield* Parser.parseArgs(Lexer.lex([]), command)
        const error = yield* Effect.flip(command.parse(parsedInput))
        assert.strictEqual(error._tag, "MissingOption")
        if (error._tag === "MissingOption") {
          assert.strictEqual(error.option, "value")
        }
      }).pipe(Effect.provide(TestLayer)))

    it("throws DuplicateOption when parent and child reuse a flag name", () => {
      const parent = Command.make("parent", {
        shared: Flag.string("shared")
      })

      const child = Command.make("child", {
        shared: Flag.string("shared")
      })

      try {
        parent.pipe(Command.withSubcommands(child))
        assert.fail("expected DuplicateOption to be thrown")
      } catch (error) {
        assert.instanceOf(error, CliError.DuplicateOption)
        const duplicate = error as CliError.DuplicateOption
        assert.strictEqual(duplicate.option, "shared")
        assert.strictEqual(duplicate.parentCommand, "parent")
        assert.strictEqual(duplicate.childCommand, "child")
      }
    })
  })
})
