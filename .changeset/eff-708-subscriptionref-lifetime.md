---
"effect": patch
---

Add lifetime tracking to `SubscriptionRef` with explicit open / closed state, scoped construction, and close semantics that interrupt interactions after shutdown.

- Change `SubscriptionRef.make` to require `Scope.Scope` and register a finalizer that transitions state to closed then shuts down the backing `PubSub`.
- Replace internal fields with a `state` union (`Open` / `Closed`), where open state stores `MutableRef` + `PubSub`.
- Make mutations publish atomically using `MutableRef.set` + `PubSub.publishUnsafe`.
- Ensure effectful interactions on closed refs interrupt.
- Add regression coverage for closed-ref interruption behavior and update atom tests for scoped `SubscriptionRef.make`.
