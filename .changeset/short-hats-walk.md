---
"@effect/openapi-generator": patch
---

Fix HttpApi multipart generation so multipart request schemas referenced via `#/components/schemas/*` are rewritten to use `Multipart.SingleFileSchema` and `Multipart.FilesSchema`.
