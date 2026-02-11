import {
  OpenAiClient,
  OpenAiConfig,
  OpenAiError,
  OpenAiLanguageModel,
  OpenAiStructuredOutput,
  OpenAiTelemetry,
  OpenAiTool
} from "@effect/ai-openai-compat"
import { assert, describe, it } from "@effect/vitest"

describe("OpenAi compat scaffold", () => {
  it("exports the expected modules", () => {
    const modules = [
      OpenAiClient,
      OpenAiConfig,
      OpenAiError,
      OpenAiLanguageModel,
      OpenAiStructuredOutput,
      OpenAiTelemetry,
      OpenAiTool
    ]

    assert.strictEqual(modules.length, 7)
    for (const mod of modules) {
      assert.isDefined(mod)
    }
  })
})
