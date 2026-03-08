import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema, Stream } from "effect"
import { Tool, Toolkit } from "effect/unstable/ai"

const LeftTool = Tool.make("LeftTool", {
  parameters: Schema.Struct({ input: Schema.String }),
  success: Schema.String
})

const RightTool = Tool.make("RightTool", {
  parameters: Schema.Struct({ input: Schema.String }),
  success: Schema.String
})

const SharedTool = Tool.make("SharedTool", {
  parameters: Schema.Struct({ input: Schema.String }),
  success: Schema.String
})

const SharedOverride = Tool.make("SharedTool", {
  parameters: Schema.Struct({ input: Schema.String }),
  success: Schema.String
})

describe("Toolkit", () => {
  it.effect("supports instance merge with right-biased overrides", () => {
    const merged = Toolkit.make(LeftTool, SharedTool).merge(
      Toolkit.make(RightTool),
      Toolkit.make(SharedOverride)
    )

    return Effect.gen(function*() {
      assert.strictEqual(merged.tools.LeftTool, LeftTool)
      assert.strictEqual(merged.tools.RightTool, RightTool)
      assert.strictEqual(merged.tools.SharedTool, SharedOverride)

      const withHandler = yield* merged
      const sharedStream = yield* withHandler.handle("SharedTool", { input: "value" })
      const sharedResults = yield* Stream.runCollect(sharedStream)

      assert.deepStrictEqual(Array.from(sharedResults), [{
        result: "shared:value",
        encodedResult: "shared:value",
        isFailure: false,
        preliminary: false
      }])
    }).pipe(
      Effect.provide(merged.toLayer({
        LeftTool: ({ input }) => Effect.succeed(`left:${input}`),
        RightTool: ({ input }) => Effect.succeed(`right:${input}`),
        SharedTool: ({ input }) => Effect.succeed(`shared:${input}`)
      }))
    )
  })
})
