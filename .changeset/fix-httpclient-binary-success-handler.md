---
"@effect/openapi-generator": patch
---

Fix `httpclient` format: binary success responses now decoded via `decodeBinary` handler in `matchStatus` instead of falling through to `unexpectedStatus`.

When an operation returns a binary content type (e.g., `application/octet-stream`, `application/zip`) at a success status, the non-streaming method now includes a `decodeBinary` handler that decodes the response body as `Uint8Array`. Previously, only the companion `*Stream` method handled binary responses — the regular method's `matchStatus` had no success case, causing all binary success responses to hit `orElse: unexpectedStatus`.

Also broadens `isBinaryMediaType` to recognize `application/zip`, `application/gzip`, `application/pdf`, `image/*`, `audio/*`, `video/*`.
