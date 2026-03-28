---
"@effect/openapi-generator": patch
---

Fix `httpclient` format to detect binary responses from any binary MIME type (not just `application/octet-stream`) and to extract JSON response schemas from `application/problem+json` and other `+json` content types (not just `application/json`).
