---
"@effect/ai-openai": patch
---

Accept `"in_memory"` (underscore) as a valid `prompt_cache_retention` value in generated response schemas.

OpenAI's live API returns `"in_memory"` in `Response` / `ChatCompletion` / related payloads, but the OpenAPI spec published by OpenAI only documents `"in-memory"` (hyphen). Strict decoding of real responses therefore fails with `InvalidOutputError` at `["prompt_cache_retention"]`. The generated schemas now accept `"in-memory" | "24h" | "in_memory"` so responses decode successfully; the spec-documented hyphen form is still preserved for requests.
