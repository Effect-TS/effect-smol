---
"effect": minor
---

Extract `Semaphore` and `Latch` into their own modules.

`Semaphore.make` / `Semaphore.unsafeMake` replace `Effect.makeSemaphore` / `Effect.makeSemaphoreUnsafe`.
`Latch.make` / `Latch.unsafeMake` replace `Effect.makeLatch` / `Effect.makeLatchUnsafe`.
