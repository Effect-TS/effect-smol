---
"effect": patch
---

HttpApi: fix middleware union errors returning 500 instead of declared httpApiStatus.

When a middleware declares `error: Schema.Union([ErrorA, ErrorB])`, each member's
`httpApiStatus` annotation was lost because the union was treated as a single schema.
`getErrorSchemas` now flattens union middleware errors into individual members.
