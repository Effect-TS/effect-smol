# Specifications

- [HttpClient RateLimiter Retry-After Persistence](./http-client-rate-limiter-retry-after.md) — Fixes queued `HttpClient.withRateLimiter` requests by storing `Retry-After` backoff through `RateLimiterStore` top-level `setRetryAfter` / `getRetryAfter` methods without changing the `RateLimiter` interface.
- [Effect SQL UniqueViolation SqlError Reason](./effect-sql-unique-violation.md) — Adds a `UniqueViolation` SQL error reason with a `constraint` property and updates driver classification for UNIQUE constraint violations.
- [Effect Platform Crypto Service](./effect-platform-crypto.md) — Adds a platform-agnostic `Crypto` service for cryptographic random bytes, native UUIDv4 generation, and digest operations.
