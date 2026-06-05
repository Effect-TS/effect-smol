---
"@effect/openapi-generator": patch
"effect": patch
---

Add HTTP API streaming response support across schema declarations, endpoint/server/client handling, OpenAPI metadata and generator output, status annotations, and widened schema service inference. Streaming HTTP API responses now support mixed buffered and streaming success responses with the same status code when content types differ. SSE event schemas must encode to the Server-Sent Events event shape, and `StreamSse({ data, error })` now exposes raw data streams to handlers and clients while handling SSE event wrapping and unwrapping internally.
