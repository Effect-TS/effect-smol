---
"effect": patch
---

Scheduler: flush fiber tasks on the microtask queue instead of `setImmediate`, falling back to a macrotask after a global budget of consecutive microtask flushes so timers and I/O are not starved. Dispatchers remain per-fiber, preserving `AsyncLocalStorage` context propagation. This significantly reduces scheduling latency for yield-heavy workloads (3-20x faster on realistic application benchmarks).

Fiber: async resumptions no longer refill the operation budget; it is refilled when the fiber yields through the scheduler. Fibers that loop over asynchronous work (e.g. `Effect.forever(Effect.promise(...))`) now yield after `maxOpsBeforeYield` cumulative operations instead of monopolizing the event loop.

Two context references expose runtime execution state, following the `MaxOpsBeforeYield` / `PreventSchedulerYield` pattern: `Scheduler.MacrotaskDispatch` holds mutable state that, while active, makes a fiber's task flushes dispatch on the macrotask queue so the host event loop turns between flushes; `Scheduler.AsyncActivity` holds mutable state that fibers update when they resume from asynchronous work (tracked at the runtime's async primitive, which underlies `Effect.callback`, `Effect.promise`, and all other asynchronous operations).

TestClock: while advancing virtual time, the clock activates `MacrotaskDispatch` and, between time steps, keeps yielding while yields produce async resumptions (observed through `AsyncActivity`). Work in flight on the host - such as a pending promise - settles at the current virtual timestamp before time advances further, making virtual time deterministic with respect to host async work. `TestClock.layer` provides both states, scoped to the test.

Sharding: `notifyLocal` no longer waits for a local entity manager before persisting outgoing notifications; the registration wait now only applies to incoming messages, which are processed locally.
