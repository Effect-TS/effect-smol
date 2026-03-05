---
"effect": patch
---

Fix `Tool` handling with `failureMode: "return"` when a provider supplies a strict codec transformer (for example OpenAI structured output) by applying transformations only to user-defined success / failure schemas and encoding `AiError` values separately.
