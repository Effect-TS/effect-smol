---
"effect": patch
---

Fix sql migrator lock handling so non-duplicate constraint failures are surfaced instead of being treated as a concurrent migration lock.
