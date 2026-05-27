---
"effect": patch
"@effect/openapi-generator": patch
---

Add `HttpApiSecurity.dpop` for validating and decoding DPoP-bound access tokens, generating the matching OpenAPI HTTP security scheme, and preserving that scheme in generated `HttpApi` modules.
