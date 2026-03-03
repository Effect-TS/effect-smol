---
"effect": patch
---

Add `text` to `AiError.StructuredOutputError` and populate it from `LanguageModel.generateObject` so failed structured output decodes include the full LLM text.
