---
"@effect/vitest": patch
---

Fix `it.describe.each`, `it.skip.each`, `it.only.each` (and similar chained access on the `it` proxy) by removing an unnecessary `value.bind(target)` from `makeItProxy`'s `get` trap. The bind stripped each function's own properties (`.each`, `.skip`, `.only`, ...), so `it.describe.each` resolved to `undefined` and threw `TypeError: it.describe.each is not a function`.
