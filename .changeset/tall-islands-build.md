---
"@effect/sql-pg": minor
---

Add single-client constructors and layers to `@effect/sql-pg`.

- Add `PgSingleClientConfig`
- Add `PgClient.makeClient(...)`
- Add `PgClient.fromClient(...)`
- Add `PgClient.layerClient(...)`
- Add `PgClient.layerFromClient(...)`

The new single-client path is designed for runtimes that want a scoped `pg.Client`
instead of a local `pg.Pool`, while still preserving transaction safety by
serializing non-transaction queries behind the reserved transaction connection.
