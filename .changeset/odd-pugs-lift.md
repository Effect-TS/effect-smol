---
"effect": patch
---

Fix SQL migrator locking detection to avoid swallowing non-duplicate insert errors (including sqlite busy locks).
