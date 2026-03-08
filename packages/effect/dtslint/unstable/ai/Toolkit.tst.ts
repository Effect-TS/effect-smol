import { Schema } from "effect"
import { Tool, Toolkit } from "effect/unstable/ai"
import { describe, expect, it } from "tstyche"

const LeftTool = Tool.make("LeftTool", {
  success: Schema.String
})

const SharedTool = Tool.make("SharedTool", {
  parameters: Schema.Struct({ left: Schema.String }),
  success: Schema.String
})

const SharedOverride = Tool.make("SharedTool", {
  parameters: Schema.Struct({ right: Schema.Number }),
  success: Schema.Number
})

describe("Toolkit", () => {
  it(".merge keeps right-biased override types", () => {
    const merged = Toolkit.make(LeftTool, SharedTool).merge(Toolkit.make(SharedOverride))
    const mergedStatic = Toolkit.merge(Toolkit.make(LeftTool, SharedTool), Toolkit.make(SharedOverride))

    expect(merged.tools.LeftTool).type.toBe<typeof LeftTool>()
    expect(merged.tools.SharedTool).type.toBe<typeof SharedOverride>()
    expect(mergedStatic.tools.SharedTool).type.toBe<typeof SharedOverride>()
  })
})
