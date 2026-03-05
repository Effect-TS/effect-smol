---
"effect": patch
---

Avoid applying provider codec transformations to toolkit handler result schemas so `failureMode: "return"` tool calls can return `AiError` values without OpenAI structured output conversion failures.
