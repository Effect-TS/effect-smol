# Migration Gotchas

Things that compile but break, or produce confusing type errors.

## 1. PlatformError is a Namespace

**Symptom:** `Cannot use namespace 'PlatformError' as a type`

```ts
// WRONG — type-only import of namespace
import type { PlatformError } from "effect"
Layer.Layer<Foo, PlatformError, Bar>

// RIGHT — value import, access class
import { PlatformError } from "effect"
Layer.Layer<Foo, PlatformError.PlatformError, Bar>
```

## 2. ServiceMap is Contravariant

**Symptom:** `ServiceMap<never>` not assignable to `ServiceMap<any>`

`ServiceMap<in Services>` — `in` = contravariant. Variance flips direction.

```ts
// BROKEN
const services: ServiceMap<any> = ServiceMap.empty()
// FIX
const services: ServiceMap<any> = ServiceMap.empty() as ServiceMap<any>
```

## 3. Config Can't Pipe with Effect

**Symptom:** Type errors piping `Config.option(...)` with `Effect.catchEager`

`Config` is `Yieldable` (supports `yield*`) but NOT an `Effect`.

```ts
// BROKEN
yield* Config.option(Config.string("HOME")).pipe(Effect.catchEager(...))
// FIX
const maybeHome = yield* Config.option(Config.string("HOME"))
const home = Option.getOrElse(maybeHome, () => os.homedir())
```

## 4. DateFromNumber Removed

No built-in number↔Date. Define with `decodeTo` + `Getter.transform`:

```ts
const DateFromNumber = Schema.Number.pipe(
  Schema.decodeTo(Schema.DateValid, {
    decode: Getter.transform((n: number) => new Date(n)),
    encode: Getter.transform((d: Date) => d.getTime()),
  }),
)
```

## 5. ChildProcess Deadlock on Large Output

**Symptom:** Hangs/timeout reading large stdout from spawned process

Internal `combinedPassThrough` (`.all` stream) fills buffer → backpressure blocks `.stdout`.

```ts
// DEADLOCKS with >16KB output
Effect.scoped(Effect.gen(function*() {
  const handle = yield* ChildProcess.spawn(cmd)
  yield* Stream.runFold(handle.stdout, ...) // hangs
}))
```

Workaround: `ChildProcess.string(cmd)` or read `.all` concurrently.

## 6. `.annotations()` Returns `any`

**Symptom:** `Struct` not assignable to `Decoder<any, never>`

`.annotations()` doesn't exist in v4 — silently returns `any`, infecting parent types.

```ts
// BROKEN
Schema.String.annotations({ title: "Name" })
// FIX
Schema.String.annotate({ title: "Name" })
```

## 7. Schema Filters Changed

**Symptom:** `Schema.int()`, `Schema.positive()`, `Schema.pattern()` don't exist

```ts
// v3
Schema.Number.pipe(Schema.int(), Schema.positive())
// v4
Schema.Int.check(Schema.isGreaterThan(0))
```

## 8. TaggedErrorClass Needs `{}`

**Symptom:** `Expected 1 arguments, but got 0`

```ts
// v3: new MyError()
// v4: new MyError({})
```

## 9. `Effect.try` Single-Arg Removed

```ts
// BROKEN
Effect.try(() => JSON.parse(str))
// FIX
Effect.try({ try: () => JSON.parse(str), catch: (e) => e as Error })
```

## 10. Stale Build Artifacts

**Symptom:** `Effect.runtime is not a function` but source has no `Effect.runtime`

Compiled `.js` from pre-migration shadows `.ts`. Bun prefers `.js`.

```bash
find . -name "*.test.js" -path "*/tests/*" -delete
find . -name "*.test.d.ts" -path "*/tests/*" -delete
```

## 11. Stream.filterMap Removed

```ts
// v3: Stream.filterMap(fn)
// v4: Stream.filter(Filter.fromPredicateOption(fn))
```

## 12. Stream.fromQueue Rejects Subscription

```ts
// v3: Stream.fromQueue(subscription)  — Subscription extended Dequeue
// v4: Stream.fromSubscription(subscription)  — separate types
```

## 13. Layer.Layer.Context Removed

```ts
type LayerContext<T> = T extends Layer.Layer<infer A, infer _E, infer _R> ? A : never
```

## 14. Effect.tap Requires Effect Return

```ts
// BROKEN
Effect.tap(() => { sideEffect() })
// FIX
Effect.tap(() => Effect.sync(() => { sideEffect() }))
```

## 15. FileSystem.File.Info.mtime

```ts
// v3: Option<Date>      →  Option.getOrElse(stat.mtime, () => new Date(0))
// v4: Date | undefined   →  stat.mtime ?? new Date(0)
```

## 16. Index Signature Access

With `noPropertyAccessFromIndexSignature`, Schema decoded types need brackets:

```ts
// ERROR: config.maxRetries
// FIX:   config["maxRetries"]
```

## 17. `Effect.ignore` No Longer Catches Defects

**Symptom:** `SQLiteError: duplicate column name` or other defects crash through `Effect.ignore`

In v3, `Effect.ignore` caught both typed errors and defects (used `catchAllCause`).
In v4, `Effect.ignore` only catches typed errors (uses `matchEffect`). Defects propagate.

```ts
// BROKEN — defect passes through
yield* sql.unsafe(`ALTER TABLE t ADD COLUMN c TEXT`).pipe(Effect.ignore)

// FIX — ignoreCause catches defects too
yield* sql.unsafe(`ALTER TABLE t ADD COLUMN c TEXT`).pipe(Effect.ignoreCause)
```

Use `Effect.ignoreCause` anywhere you need to swallow ALL failures including defects.

## 18. `ServiceMap.Service` is Not an `Effect`

**Symptom:** `Maximum call stack size exceeded` or `Not a valid effect` at runtime

`ServiceMap.Service` is `Yieldable` (works with `yield*` in generators) and `Pipeable` but NOT an `Effect`. Piping with `Effect.flatMap` wraps the service tag as an effect operand, which the runtime can't evaluate.

The Formatter then tries `String(service)` → `toString()` → `format(this)` → `safeToString(this)` → `toString()` → infinite recursion (beta bug).

```ts
// BROKEN — Service is not an Effect, runtime can't evaluate it
AuthStore.pipe(
  Effect.flatMap((auth) => auth.get("key")),
  Effect.provide(layer),
)

// FIX (preferred) — .use() for single-op access
AuthStore.use((auth) => auth.get("key")).pipe(Effect.provide(layer))

// FIX — Effect.gen for multi-step
Effect.gen(function* () {
  const auth = yield* AuthStore
  return yield* auth.get("key")
}).pipe(Effect.provide(layer))

// FIX — .asEffect() if you need the pipe chain
AuthStore.asEffect().pipe(
  Effect.flatMap((auth) => auth.get("key")),
  Effect.provide(layer),
)
```

**Service API in v4:**
- `Service.use(fn)` — effectful access, returns `Effect<A, E, R | Identifier>`
- `Service.useSync(fn)` — sync access, returns `Effect<A, never, Identifier>`
- `Service.asEffect()` — converts to a real `Effect` (memoized)
- `yield* Service` — still works in generators via `Yieldable`

## Post-Migration Checklist

- [ ] No stale `.js` artifacts shadowing `.ts` test files
- [ ] No `import type { PlatformError }` (must be value import)
- [ ] All `.annotations(` → `.annotate(`
- [ ] All `Schema.decodeUnknown(` → `Schema.decodeUnknownEffect(`
- [ ] No `Config.option(...).pipe(Effect.` patterns
- [ ] Tests run (not just typecheck)
- [ ] Large-output shell tests don't timeout
- [ ] No `Effect.ignore` on code that throws defects (use `Effect.ignoreCause`)
- [ ] No `ServiceTag.pipe(Effect.flatMap(...))` — use `.use()` or `Effect.gen`
- [ ] No `Fiber.poll(fiber)` — use `fiber.pollUnsafe()`
