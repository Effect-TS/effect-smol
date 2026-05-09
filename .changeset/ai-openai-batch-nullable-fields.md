---
"@effect/ai-openai": patch
---

Fix Batch API decode failures when OpenAI returns `null` for `model`, `output_file_id`, or `error_file_id`. The OpenAPI spec marks these fields as optional but not nullable, while OpenAI returns `null` (e.g. `model: null` on a freshly created batch that hasn't been validated yet, `output_file_id: null` until the batch completes). Patched the codegen spec to mark all three nullable.
