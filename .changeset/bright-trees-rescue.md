---
"effect": patch
---

Add store-scoped transactional storage primitives to the unstable unencrypted eventlog server storage contract.

makeStorageMemory now supports rollback-safe transaction-local writes via `withStoreTransaction`, commits staged writes atomically, and only publishes change notifications for committed entries. The in-memory implementation also serializes transactions per store while allowing concurrent transactions on different stores.

Add focused EventLogServerUnencrypted storage tests for commit visibility, rollback behavior, transaction-local deduplication, and store-scoped contention.
