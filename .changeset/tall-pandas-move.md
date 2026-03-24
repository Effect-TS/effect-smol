---
"@effect/openapi-generator": patch
---

Fix HttpApi generation to include path-level OpenAPI parameters when parsing operations, which unblocks specs like Discord that define route parameters on path items.
