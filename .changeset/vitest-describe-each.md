---
"@effect/vitest": patch
---

Preserve the chained helpers Vitest attaches to its test and suite functions when accessed through `it`, so `it.describe.each` (and similar) no longer throw `it.describe.each is not a function`.
