import { Effect } from "effect"
import { Command, Flag, GlobalFlag } from "effect/unstable/cli"
import { describe, expect, it } from "tstyche"

describe("Command", () => {
  describe("withGlobalFlags", () => {
    it("strips setting context from mixed global flags", () => {
      const VerboseAction = GlobalFlag.action({
        flag: Flag.boolean("verbose").pipe(Flag.withDefault(false)),
        run: () => Effect.void
      })
      const Format = GlobalFlag.setting("format")({
        flag: Flag.string("format").pipe(Flag.withDefault("text"))
      })

      const command = Command.make("example", {}, () =>
        Effect.gen(function*() {
          yield* Format
        })).pipe(
          Command.withGlobalFlags([VerboseAction, Format])
        )

      expect(command).type.toBe<Command.Command<"example", {}, never, never>>()
    })

    it("strips setting context in data-first form", () => {
      const VerboseAction = GlobalFlag.action({
        flag: Flag.boolean("verbose").pipe(Flag.withDefault(false)),
        run: () => Effect.void
      })
      const Format = GlobalFlag.setting("format")({
        flag: Flag.string("format").pipe(Flag.withDefault("text"))
      })

      const command = Command.withGlobalFlags(
        Command.make("example", {}, () =>
          Effect.gen(function*() {
            yield* Format
          })),
        [VerboseAction, Format]
      )

      expect(command).type.toBe<Command.Command<"example", {}, never, never>>()
    })
  })
})
