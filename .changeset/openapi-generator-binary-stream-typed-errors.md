---
"@effect/openapi-generator": patch
---

Generate binary (e.g. `application/pdf`, `format: binary`) success responses as typed `*Stream` clients with typed OpenAPI error responses, instead of decoding them as JSON strings.

Binary success responses are now detected by schema shape (`type: string` with `format`/`contentEncoding: binary`) and by binary media types (including `application/pdf`), not just `application/octet-stream`. An operation whose only success response is binary generates a single `${id}Stream` method whose error channel includes the operation's typed OpenAPI error responses plus `HttpClientError` / `SchemaError`; the redundant JSON method is no longer emitted for it. `binaryRequest` now matches on status so per-status error bodies decode into their typed variants.
