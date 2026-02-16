# Filter Refactor: Box Pass Values and Accept Predicates

## Summary

Refactor `Filter.Filter` to box both pass and fail return values (`pass<B> | fail<X>`)
instead of only boxing failures. This enables every API that accepts a `Filter` to also
accept a plain `Predicate` or `Refinement` via overloads, with no runtime ambiguity.

## Background

`Filter<Input, Pass, Fail>` is currently `(input: Input) => Pass | fail<Fail>`. The pass
value is unboxed. This makes it impossible to also accept `Predicate<Input>` (which returns
`boolean`) in the same parameter position because:

1. **Runtime**: a boolean return is indistinguishable from a pass value of `true`/`false`.
2. **Type-level**: if the `Filter` return type includes `boolean`, TypeScript cannot prevent
   a predicate from matching a `Filter<A, B, X>` overload with arbitrary `B`.

Boxing pass values (`pass<B>`) makes `Filter` and `Predicate` structurally distinct at both
runtime and type level, allowing clean overload resolution.

## Goals

- Change `Filter<Input, Pass, Fail>` to return `pass<Pass> | fail<Fail>`.
- Change `FilterEffect<Input, Pass, Fail, E, R>` to return `Effect<pass<Pass> | fail<Fail>, E, R>`.
- Add `pass<A>` branded type and `Filter.pass(value)` constructor.
- Add predicate/refinement overloads to all 22 public APIs that accept `Filter`.
- Merge `catchIf` into `catchFilter` (and similar predicate variants into their Filter
  counterparts) where appropriate, removing the separate predicate-only APIs.
- Update all internal filter functions (`findError`, `findDefect`, `findDie`,
  `findInterrupt`, `exitFilterCause`, `exitFilterSuccess`, etc.) to return `pass<T>`.
- Update all consumption sites to check `isPass`/`isFail` instead of just `isFail`.

## Non-goals

- No changes to `Filter.FilterEffect` beyond updating the return type.
- No new filter combinators.
- No changes to APIs that already only accept predicates (e.g. `Effect.filterOrElse`).

## Design

### New Types

```ts
interface pass<out A> {
  readonly [PassTypeId]: typeof PassTypeId
  readonly pass: A
}

interface fail<out A> {
  readonly [FailTypeId]: typeof FailTypeId
  readonly fail: A
}

// Filter now returns boxed values on both branches
interface Filter<in Input, out Pass = Input, out Fail = Input> {
  (input: Input): pass<Pass> | fail<Fail>
}

interface FilterEffect<in Input, out Pass, out Fail, out E = never, out R = never> {
  (input: Input): Effect<pass<Pass> | fail<Fail>, E, R>
}
```

### Constructors

```ts
// New
const pass: <A>(value: A) => pass<A>
const passVoid: pass<void>
const isPass: (u: unknown) => u is pass<A>

// Updated
const make: <Input, Pass, Fail>(
  f: (input: Input) => pass<Pass> | fail<Fail>
) => Filter<Input, Pass, Fail>

// fromPredicate remains, but now wraps with pass()
const fromPredicate: {
  <A, B extends A>(refinement: Refinement<A, B>): Filter<A, B, Exclude<A, B>>
  <A>(predicate: Predicate<A>): Filter<A>
}
// Implementation: (input) => predicate(input) ? pass(input) : fail(input)
```

### Overload Strategy

Every API that currently accepts `Filter.Filter<A, B, X>` gains overloads for
`Predicate<A>` and `Refinement<A, B>`. TypeScript resolves the correct overload because:

- `Refinement<A, B>` returns `input is B` (special `boolean` subtype) — matched first
- `Predicate<A>` returns `boolean` — matched second
- `Filter<A, B, X>` returns `pass<B> | fail<X>` — **structurally distinct from `boolean`**,
  so a predicate cannot accidentally match this overload

At runtime, the implementation calls the function and inspects the result:
- `true` → pass (use original input)
- `false` → fail (use original input)
- `isPass(result)` → extract `.pass`
- `isFail(result)` → extract `.fail`

A single internal helper normalizes this:

```ts
const applyFilter = <A, B, X>(
  filter: Filter<A, B, X> | Predicate<A> | Refinement<A, B>,
  input: A
): pass<A | B> | fail<A | X> => {
  const result = filter(input)
  if (result === true) return pass(input)
  if (result === false) return fail(input)
  return result // pass<B> | fail<X>
}
```

### API Changes

For each affected API, add refinement and predicate overloads. When a separate
predicate-only variant already exists (e.g. `catchIf` for `catchFilter`), merge it into the
Filter-based API and remove the standalone variant.

#### APIs to merge (remove predicate-only variant)

| Filter API | Predicate variant to remove |
|---|---|
| `Effect.catchFilter` | `Effect.catchIf` |
| `Stream.catchFilter` | `Stream.catchIf` |

#### APIs to add overloads (no existing predicate variant to remove)

| Module | Function |
|---|---|
| Effect | `catchCauseFilter` |
| Effect | `tapCauseFilter` |
| Effect | `filterMap` |
| Effect | `onErrorFilter` |
| Effect | `onExitFilter` |
| Stream | `filterMap` |
| Stream | `filterMapEffect` |
| Stream | `partitionFilter` |
| Stream | `partitionFilterQueue` |
| Stream | `partitionFilterEffect` |
| Stream | `catchFilter` |
| Stream | `catchCauseFilter` |
| Channel | `filterMap` |
| Channel | `filterMapEffect` |
| Channel | `filterMapArray` |
| Channel | `filterMapArrayEffect` |
| Channel | `catchCauseFilter` |
| Channel | `catchFilter` |
| Sink | `takeFilter` |
| Sink | `takeFilterEffect` |
| Array | `partitionFilter` |

#### APIs with existing predicate variants that remain separate

Some APIs have predicate counterparts with different semantics (not just a wrapped Filter).
These stay as-is:

| Filter API | Predicate API (keep separate) | Reason |
|---|---|---|
| `Stream.filterMap` | `Stream.filter` | `filter` doesn't transform, returns `Stream<A>` not `Stream<B>` |
| `Channel.filterMap` | `Channel.filter` | Same |
| `Sink.takeFilter` | `Sink.takeWhile` | Different semantics (while vs filter) |
| `Array.partitionFilter` | `Array.partition` | `partition` returns `[A[], A[]]` not `[Pass[], Fail[]]` |

### Internal Filter Functions

All internal filters in `packages/effect/src/internal/effect.ts` must wrap pass values:

```ts
// Before:
const findError = <E>(cause: Cause<E>): E | fail<Cause<never>> => {
  // ...
  return reason.error  // unboxed
}

// After:
const findError = <E>(cause: Cause<E>): pass<E> | fail<Cause<never>> => {
  // ...
  return pass(reason.error)  // boxed
}
```

Affected internal filters:
- `findError`
- `findFail`
- `findDefect`
- `findDie`
- `findInterrupt`
- `causeFilterInterruptors`
- `exitFilterCause`
- `exitFilterSuccess`
- `exitFilterFailure`
- `exitFilterValue`
- `exitFindError`
- `exitFindDefect`

### Consumption Sites

All sites that currently check `Filter.isFail(result)` and use the result directly as the
pass value must be updated to extract `.pass`:

```ts
// Before:
const result = filter(error)
if (Filter.isFail(result)) { /* fail path */ }
// result is the pass value directly
f(result)

// After:
const result = applyFilter(filter, error)
if (Filter.isFail(result)) { /* fail path */ }
f(result.pass)
```

### Filter Combinators

All combinators in `Filter.ts` must be updated to work with boxed pass values:

- `or`: unwrap left pass, else try right
- `compose`: unwrap left pass, feed to right
- `composePassthrough`: same but fail with original input
- `zip` / `zipWith` / `andLeft` / `andRight`: unwrap both passes
- `mapFail`: only touches fail, but still needs to propagate `pass<T>`
- `toOption`: unwrap pass to `Some`, fail to `None`
- `toResult`: unwrap pass to `Success`, fail to `Failure`

### Existing Constructors

These return `Filter` and must produce `pass<T>`:

- `fromPredicate` → `pass(input)` / `fail(input)`
- `fromPredicateOption` → `pass(option.value)` / `fail(input)`
- `fromPredicateResult` → `pass(result.success)` / `fail(result.failure)`
- `tagged` → `pass(input)` / `fail(input)`
- `equals` → `pass(value)` / `fail(input)`
- `equalsStrict` → `pass(value)` / `fail(input)`
- `has` → `pass(input)` / `fail(input)`
- `instanceOf` → `pass(input)` / `fail(input)`
- `try` → `pass(f(input))` / `fail(input)`
- `string`, `number`, `boolean`, `bigint`, `symbol`, `date` → delegate to `fromPredicate`

## Migration

### For users writing inline filters

```ts
// Before:
Stream.filterMap((n: number) => n > 0 ? n * 2 : Filter.fail(n))

// After (transformation):
Stream.filterMap((n: number) => n > 0 ? Filter.pass(n * 2) : Filter.fail(n))

// After (predicate, no transformation):
Stream.filterMap((n: number) => n > 0)

// After (refinement):
Stream.filterMap((x): x is string => typeof x === "string")
```

### For users of catchIf

```ts
// Before:
Effect.catchIf(program, (e): e is NotFound => e._tag === "NotFound", handler)

// After (catchIf removed, use catchFilter with refinement):
Effect.catchFilter(program, (e): e is NotFound => e._tag === "NotFound", handler)
```

### For users of Filter.make

```ts
// Before:
Filter.make((n: number) => n > 0 ? n * 2 : Filter.fail(n))

// After:
Filter.make((n: number) => n > 0 ? Filter.pass(n * 2) : Filter.fail(n))
```

## Testing

- Update all existing Filter tests to use `Filter.pass()` for pass values.
- Add tests for predicate overloads on each affected API:
  - `Predicate` returning `boolean` → pass-through or filter out
  - `Refinement` → type narrowing
  - `Filter` with `pass<B>` → transformation
- Verify that `catchFilter` with predicate/refinement behaves identically to old `catchIf`.
- Use `it.effect` from `@effect/vitest` and `assert` (no `expect`).

## Validation

- `pnpm lint-fix`
- `pnpm test <relevant test files>`
- `pnpm check` (run `pnpm clean` then re-run if it fails)
- `pnpm build`
- `pnpm docgen`

## Acceptance Criteria

- `Filter.Filter` returns `pass<Pass> | fail<Fail>`, never unboxed values.
- `Filter.pass`, `Filter.passVoid`, `Filter.isPass` are exported.
- All 22 Filter-accepting APIs also accept `Predicate` and `Refinement`.
- `Effect.catchIf` and `Stream.catchIf` are removed; `catchFilter` absorbs their overloads.
- All internal filter functions return `pass<T>`.
- All consumption sites use `result.pass` / `result.fail` to extract values.
- All filter combinators work with boxed pass values.
- All existing tests pass after migration.
- New tests cover predicate and refinement overloads.
