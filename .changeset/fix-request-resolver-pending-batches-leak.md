---
"effect": patch
---

Fix `RequestResolver` retention leak in `Effect.request` machinery.

The module-level `pendingBatches` map in `internal/request.ts` keyed by
`RequestResolver` was a strong-reference `Map`, so every resolver instance
ever passed to `Effect.request` was retained for the lifetime of the
process. Code that mints a resolver per request (e.g.
`RequestResolver.withCache(...)` inside a per-request scope) accumulated
caches and their entries indefinitely.

Switched `pendingBatches` to a `WeakMap`, and additionally cleared the
`resolver` / `map` fields on pooled `Batch` objects so the recycle pool
does not pin previously-used resolvers either.
