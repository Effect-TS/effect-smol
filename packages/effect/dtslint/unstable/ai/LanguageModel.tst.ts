import type { Effect } from "effect"
import { Schema } from "effect"
import { type AiError, LanguageModel, Tool, Toolkit } from "effect/unstable/ai"
import { describe, expect, it } from "tstyche"

const FailureModeErrorTool = Tool.make("FailureModeErrorTool", {
  parameters: Schema.Struct({
    input: Schema.String
  }),
  success: Schema.Struct({
    output: Schema.String
  }),
  failure: Schema.Struct({
    message: Schema.String
  })
})

describe("LanguageModel", () => {
  describe("generateText", () => {
    it("tool handlers do not leak AiErrorReason into the error channel", () => {
      const toolkit = Toolkit.make(FailureModeErrorTool)
      const program = LanguageModel.generateText({
        prompt: "hello",
        toolkit
      })

      type ProgramError = typeof program extends Effect.Effect<any, infer E, any> ? E : never

      expect<ProgramError>().type.toBe<AiError.AiError | { readonly message: string }>()
      expect<Extract<ProgramError, AiError.AiErrorReason>>().type.toBe<never>()
    })
  })
})
