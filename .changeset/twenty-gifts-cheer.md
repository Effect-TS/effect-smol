---
"effect": patch
---

Fix OpenAI structured output schema generation to inline top-level `$ref` definitions so the root schema is an object (required by OpenAI for `json_schema` response formats).
