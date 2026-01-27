# Effect.ts JSDoc upgrades

## Summary

Improve the JSDoc coverage in `packages/effect/src/Effect.ts` by improving
descriptions, adding missing `@example` blocks for value exports (and one missing `@category`).

## Background

`Effect.ts` is the core module for the Effect library. A small set of exported
APIs are missing `@example` tags or a `@category`. `Queue.ts` shows the desired
documentation quality: concise summaries, practical examples, consistent tags,
and outputs where useful. This work aligns `Effect.ts` docs to that standard.
Type-only exports (for example, `Variance` or `TagsWithReason`) do not require
examples.

## Goals

- Add `@example` blocks for all missing-example exports in `Effect.ts`.
- Add the missing `@category` for `replicate`.
- Keep existing descriptions and tags intact while improving clarity.
- Update JSDoc descriptions where wording is unclear or outdated.
- Ensure all new examples compile via `pnpm docgen`.

## Non-goals

- No runtime or behavior changes to Effect APIs.
- No signature changes or new exports.
- No new `@example` blocks for type-only exports.
- No doc changes outside `packages/effect/src/Effect.ts`, except the spec index.

## Requirements

### Scope

- File: `packages/effect/src/Effect.ts`
- Baseline style reference: `packages/effect/src/Queue.ts`

### Documentation style

- Keep existing summary/Details/When to Use sections unless clearly incorrect.
- Refresh existing descriptions when needed for clarity or accuracy, keeping
  changes minimal.
- Add `@example` blocks that use `Effect.gen`, `pipe`, and `Effect.run*` as
  appropriate, mirroring `Queue.ts` style.
- If an example includes output comments (for example, `// Output: ...`), run it
  from `scratchpad/` (for example, `node scratchpad/<file>.ts`) and use the
  observed output. Skip output comments when results are nondeterministic.
- Use ASCII only.
- If an example exists but is not tagged, convert it to `@example` and keep the
  content.
- Preserve existing `@since` and `@category` tags; only add the missing
  `@category` for `replicate`.

### API coverage and example focus

Add or convert `@example` blocks for the following value exports (all in
`packages/effect/src/Effect.ts`), with the example focus noted below:

- `fromNullishOr` (around `Effect.ts:1684`): show `null` / `undefined` failing
  with `NoSuchElementError` and a non-null value succeeding.
- `flatten` (around `Effect.ts:1790`): show flattening `Effect<Effect<A>>` to
  `Effect<A>`.
- `option` (around `Effect.ts:2074`): show success -> `Option.some`, failure ->
  `Option.none` using `Effect.runPromise`.
- `catchIf` (around `Effect.ts:2962`): convert existing inline example to a
  proper `@example` tag; keep the predicate-based recovery flow.
- `tapErrorTag` (around `Effect.ts:3286`): convert the current inline example
  into a `@example` block.
- `eventually` (around `Effect.ts:3469`): show a flaky effect with a counter
  that eventually succeeds.
- `withExecutionPlan` (around `Effect.ts:3793`): show `ExecutionPlan.make(...)`
  and `Effect.withExecutionPlan(...)` with a simple fallback layer or
  service map.
- `timed` (around `Effect.ts:4102`): show timing an effect and inspecting the
  `[duration, result]` tuple.
- `raceFirst` (around `Effect.ts:4215`): show two effects racing and returning
  the first completion (success or failure), with a simple delay.
- `filterMap` (around `Effect.ts:4273`): use `Filter.makeEffect` plus
  `Filter.fail` to keep and transform matching values.
- `matchCauseEffectEager` (around `Effect.ts:4667`): show effectful handlers for
  success and failure, similar to `matchCauseEager`.
- `isFailure` (around `Effect.ts:4857`): convert the existing example to an
  `@example` block (includes defect behavior).
- `isSuccess` (around `Effect.ts:4874`): add a success + failure example with
  `Effect.runSync` or `Effect.runPromise`.
- `onErrorFilter` (around `Effect.ts:5790`): show filtering causes (for example
  with `Filter.fromPredicate(Cause.hasFail)`) and logging only matching errors.
- `onExitInterruptible` (around `Effect.ts:5842`): show a finalizer that can be
  interrupted (for example, a long `Effect.sleep`), with a short note in the
  example.
- `onExitFilter` (around `Effect.ts:5856`): filter `Exit` values (for example,
  `Filter.fromPredicate(Exit.isFailure)`) and handle only failures.
- `replicate` (around `Effect.ts:6781`): add `@category Repetition / Recursion`
  (or align with the surrounding category) and add an example showing
  replication + `Effect.all` to run the array.
- `replicateEffect` (around `Effect.ts:6809`): show collecting results and the
  `discard: true` option.
- `request` (around `Effect.ts:7445`): show a minimal request type created with
  `Request.tagged`, a resolver, and `Effect.request` usage.
- `requestUnsafe` (around `Effect.ts:7465`): show low-level usage with
  `RequestResolver`, `ServiceMap.empty()`, `onExit`, and the cancel function.
- `fiber` (around `Effect.ts:7668`): show accessing the current fiber and using
  a field like `fiber.id` or joining.
- `fiberId` (around `Effect.ts:7676`): show reading the current fiber id in a
  generator.
- `runCallbackWith` (around `Effect.ts:7794`): show running an effect with
  services and an `onExit` callback, returning a cancel function.
- `runCallback` (around `Effect.ts:7805`): show `onExit` usage and canceling.
- `fn` (around `Effect.ts:12249`): show `Effect.fn("name")(function*...)` and
  returning an effectful function.
- `logWithLevel` (around `Effect.ts:12292`): show creating a logger at a
  specific level and invoking it.

## Validation

- `pnpm lint-fix`
- `pnpm test packages/effect/test/Effect.test.ts`
- `pnpm check` (run `pnpm clean` then re-run if it fails)
- `pnpm build`
- `pnpm docgen`

## Acceptance Criteria

- Every API listed above has a concise and helpful description, `@example` block, or its existing example has
  been converted into a `@example` block.
- Type-only exports do not gain new `@example` blocks.
- `replicate` has an explicit `@category` tag consistent with the surrounding
  section.
- Examples compile with `pnpm docgen` and match `Queue.ts` style.
- Any example output comments match the output observed from running the
  `scratchpad/` example.
- No runtime or signature changes are introduced.
