---
"effect": patch
"@effect/platform-node": patch
"@effect/platform-node-shared": patch
"@effect/platform-bun": patch
"@effect/platform-browser": patch
---

Add a platform-agnostic `Crypto` service for cryptographic random bytes, native UUIDv4 generation, and digest operations. UUID generation should now use `Crypto.randomUUIDv4`; `Random.nextUUIDv4` has been removed because `Random` is pseudo-random and seedable.
