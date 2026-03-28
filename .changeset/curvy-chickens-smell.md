---
"effect": patch
---

Simplify unstable eventlog server store mapping to a read-only runtime contract by removing `StoreMapping.assign(...)`, validating server-authored writes exclusively through `hasStore(storeId)`, and migrating memory/persisted mapping test setup to seeded inputs.
