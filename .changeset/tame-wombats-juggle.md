---
"effect": minor
---

Add `Schema.newtype` for fully opaque types with `NewtypeBrand<K, From>` carrier. Unlike `Schema.brand`, which exposes the underlying type, `newtype` produces a fully opaque type while carrying the original type as a phantom for recovery via `NewtypeFrom<T>`. Uses a separate `newtypes` annotation independent of `brands`.
