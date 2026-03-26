---
"effect": patch
---

Simplify `EventLogServerUnencrypted.layer(schema)` so it no longer requires `EventJournal.EventJournal` in its input environment, and update eventlog server runtime helpers to stop providing `EventJournal` when building unencrypted server layers.
