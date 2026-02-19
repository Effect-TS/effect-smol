---
"effect": patch
---

`Stream.fromQueue` now accepts `PubSub.Subscription` in addition to `Queue.Dequeue`, restoring the v3 pattern where subscriptions could be passed directly.
