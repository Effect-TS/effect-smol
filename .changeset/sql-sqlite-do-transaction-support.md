---
"@effect/sql-sqlite-do": minor
---

Add transaction support via `DurableObjectStorage.transactionSync`.

Cloudflare DO's `sql.exec()` cannot execute transaction control statements (`BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`). Pass the `storage` option to enable real transactions:

```typescript
SqliteClient.make({ storage: ctx.storage })
```

Without `storage`, `withTransaction` now dies with a clear error message instead of silently failing.
