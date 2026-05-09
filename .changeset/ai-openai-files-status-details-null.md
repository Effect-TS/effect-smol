---
"@effect/ai-openai": patch
---

Fix Files API decode failure when OpenAI returns `status_details: null`. The OpenAPI spec marks `OpenAIFile.status_details` as optional but not nullable, while OpenAI actually returns `null`, so `createFile` / `retrieveFile` / `listFiles` failed with `SchemaError(Expected string, got null at ["status_details"])`. Patched the codegen spec to mark the field nullable.
