---
"effect": patch
"@effect/sql-sqlite-node": patch
---

Migrate unstable EventLog server routing to scope encrypted and unencrypted flows by `(publicKey, storeId)`.

- Encrypted server storage, replay/live changes, deduplication, and handler subscription tracking are now keyed by `(publicKey, storeId)`.
- `StopChanges` and multiplexed runtime subscription handling now target specific `(publicKey, storeId)` subscriptions.
- SQLite EventLog server storage now derives scope resources from both `publicKey` and `storeId`, so stores under the same public key no longer share backing tables.
- Unencrypted server mapping and request routing now resolve stores using both `publicKey` and requested `storeId` while keeping Authenticate publicKey-scoped.
