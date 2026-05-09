---
"@effect/ai-openai": patch
---

Fix decode failures when OpenAI returns `null` for fields the OpenAPI spec marks as optional but not nullable. Affects `OpenAIFile.status_details` (Files API: `createFile` / `retrieveFile` / `listFiles`) and `Batch.model` / `Batch.output_file_id` / `Batch.error_file_id` (Batch API: `createBatch` / `retrieveBatch` / `listBatches`). All four sites previously raised `SchemaError(Expected string, got null)` against responses OpenAI actually returns. Patched the codegen spec to mark each field nullable.
