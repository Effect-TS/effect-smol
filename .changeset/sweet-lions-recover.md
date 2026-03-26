---
"effect": patch
---

Implement store-level reconciliation in EventLogServerUnencrypted so persisted transport backlog entries are replayed into the processing journal after restart/failure without duplicating handler execution or Reactivity invalidation.
