---
"@effect/openapi-generator": patch
---

Fix HttpApi multipart schema generation to recognize file fields defined with `contentEncoding: "binary"` in OpenAPI request bodies.
