import {
  OpenAiClient,
  OpenAiConfig,
  OpenAiError,
  OpenAiLanguageModel,
  OpenAiStructuredOutput,
  OpenAiTelemetry
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
      OpenAiTelemetry
    ]

    assert.strictEqual(modules.length, 6)
    for (const mod of modules) {
      assert.isDefined(mod)
    }
  })
})
