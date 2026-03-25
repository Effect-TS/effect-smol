---
"effect": patch
---

Add a `scope` option to `Effect.RunOptions`. When provided, fibers started by runtime run APIs are linked to that scope and interrupted when the scope closes.
