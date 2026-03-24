---
"effect": patch
---

Add `Stream.timeoutOrElse`, rewrite `Stream.timeout` to delegate to it, and optimize stream timeout handling to avoid creating a timeout fiber for each pull.
