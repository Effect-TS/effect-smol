---
"effect": patch
---

Fix `HttpApiSchema.StreamSse({ data })` so the decoded data schema keeps its identifier in the generated OpenAPI spec.

The SSE `data` field is encoded as a JSON string, and that string wrapper was claiming the data schema's `identifier`, pushing the real schema to a suffixed name (e.g. `MyEvent` became the `string` wrapper while the decoded object became `MyEvent1`). This inverted the names for OpenAPI codegen consumers. The wrapper now gets its own `${identifier}Stream` name, leaving the data schema's identifier intact.
