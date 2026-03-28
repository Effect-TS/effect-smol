---
"effect": patch
---

unstable/eventlog: add server-authored `EventLogServerUnencrypted.write({ schema, storeId, event, payload, entryId? })` support with store provisioning checks and focused server-write idempotency / fan-out coverage.
