---
"effect": minor
---

Add `Schema.opaqueBrand` for fully opaque primitive types. It keeps `Schema.brand` runtime behavior while returning an opaque `Brand.Brand<B>` type instead of exposing the primitive base type.
