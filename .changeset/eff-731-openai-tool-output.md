---
"@effect/ai-openai": patch
---

Fix OpenAI function call output serialization when a tool returns `undefined` so the request always includes an `output` field.
