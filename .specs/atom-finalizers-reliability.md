# Atom Finalizer Reliability (EFF-415)

## Summary

Investigate why Atom finalizers can appear to "not run" in
`effect/unstable/reactivity`.

## Findings

- Finalizers are stored on `Lifetime` and executed in
  `packages/effect/src/unstable/reactivity/AtomRegistry.ts` inside
  `LifetimeProto.dispose`.
- `dispose` runs `finalizers[i]()` directly in reverse order, with no
  `try/catch`.
- Node disposal triggered by `registry.mount(... )` unmount is async:
  `subscribe` cleanup -> `scheduleNodeRemoval` -> async scheduler task.
- `packages/effect/src/Scheduler.ts` `MixedScheduler.runTasks` also runs tasks
  without `try/catch`.

### Consequence

If any Atom finalizer throws:

1. Remaining finalizers in that same `Lifetime` are skipped.
2. The error escapes the async scheduler callback.
3. Remaining scheduler tasks in that tick can be skipped as stack unwinds,
   so other pending node removals / finalizers may not execute.

This is the main reason finalizers can seem unreliable.

## Repro Notes

A temporary repro test (`packages/effect/test/reactivity/EFF-415.repro.test.ts`,
not committed) confirmed the throw path:

- stack included `LifetimeProto.dispose` at `AtomRegistry.ts:913`
- then `NodeImpl.remove` -> `RegistryImpl.removeNode` ->
  `MixedScheduler.runTasks`

## Proposed Implementation Plan

1. Make `LifetimeProto.dispose` resilient:
   - execute all finalizers even when one throws
   - capture thrown errors while continuing the loop
2. Decide error policy after running all finalizers:
   - preserve current fail-fast semantics by rethrowing first error after loop,
     or
   - report aggregated error in a controlled way (avoid aborting unrelated
     scheduler tasks)
3. Add regression tests in `packages/effect/test/reactivity/Atom.test.ts`:
   - all finalizers run even if one throws
   - scheduler queue continues running cleanup work when a finalizer fails

## Validation (for implementation task)

- `pnpm lint-fix`
- `pnpm test packages/effect/test/reactivity/Atom.test.ts`
- `pnpm check` (run `pnpm clean` then re-run if needed)
- `pnpm build`
- `pnpm docgen`
