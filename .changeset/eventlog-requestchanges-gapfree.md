---
"effect": patch
---

Refactor `EventLogServerUnencrypted.requestChanges(...)` to consume a single gap-free shared-storage feed, preserve initial backlog compaction, and add focused multi-replica change-stream regression coverage.
