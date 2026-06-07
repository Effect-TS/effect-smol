---
"effect": minor
---

AtomRegistry: dedupe atom writes by value equality (`Equal.equals`) instead of reference identity (`Object.is`).

When an atom is set to a fresh-reference value that is `Equal.equals` to its current value, the registry no longer treats it as a change: no subscribers are notified and no downstream atoms are invalidated. A genuinely different value still notifies and invalidates as before.

This restores the value-equality dedup behavior of the standalone v3 `@effect-atom/atom` package, which used `Equal.equals` in its `setValue` guard. The guard narrowed to `Object.is` during the bulk port of the Atom subsystem into core, while the sibling `AtomRef` kept `Equal.equals` — an inconsistency this change resolves. Atoms holding structurally-equal values (e.g. `Data` instances, `Option`, `Result`) now behave as expected without an opt-in combinator.
