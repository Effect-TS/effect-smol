---
"effect": patch
"@effect/platform-node": patch
"@effect/platform-node-shared": patch
"@effect/platform-bun": patch
"@effect/platform-browser": patch
---

Add a platform-agnostic `Crypto` service for cryptographic random bytes, secure random generators, UUIDv4 generation, and digest operations. UUID generation should now use module-level `Crypto.randomUUIDv4`, which formats bytes from the platform `Crypto` service; `Random.nextUUIDv4` has been removed because the base `Random` service is not cryptographically secure.
