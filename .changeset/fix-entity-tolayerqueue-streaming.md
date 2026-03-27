---
"effect": patch
---

Fix `Entity.toLayerQueue` crash with streaming RPCs when using `replier.succeed` with a `Stream` value.

`RpcServer.streamEffect` now handles both `Stream` and `Queue.Dequeue` values when the handler is an `Effect` (as produced by `toLayerQueue`).
