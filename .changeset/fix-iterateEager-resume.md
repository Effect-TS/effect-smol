---
"effect": patch
---

Fix resume hang in `iterateEager` (concurrent `Effect.forEach`) where the outer fiber could remain suspended on the async callback after all child fibers drained.

Each `go()` invocation captured its own `paused` local. Observers forked during a paused call always entered the `if (paused)` branch and skipped the `else if (done && fibers.size === 0)` resume branch. In edge cases this left the request fiber suspended indefinitely, retaining `parentFiber`, items, schema state, and accumulated input across requests.

Fix:
- Make the `done && fibers.size === 0` resume check independent of the `paused` branch.
- Read-clear `resume` before invoking it to make resume idempotent and release the closure reference earlier.
