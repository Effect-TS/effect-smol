# Regressions — v4 Ergonomic Downgrades

Things that worked well in v3 and are worse in v4 — not bugs per se, but friction that hurts DX.

---

## 1. `new TaggedErrorClass({})` Requires Empty Object

**Impact:** Every zero-field error instantiation needs updating

v3 allowed `new MyError()` for errors with no fields. v4 requires `new MyError({})`. This is a paper-cut across every `throw new FooError()` site.

```ts
class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", {}) {}

// v3
throw new NotFoundError()   // fine

// v4
throw new NotFoundError()   // Error: Expected 1 arguments, but got 0
throw new NotFoundError({}) // required
```

**Suggestion:** Default to `{}` when fields are empty — no information is being passed.

---

## 2. `Schema.DateFromNumber` Removed Without Replacement

**Impact:** Every project storing dates as epoch milliseconds (common in SQLite, JSON)

v3 had `Schema.DateFromNumber` — a common schema for `number ↔ Date` transformation. v4 removes it with no built-in replacement. Users must define it manually using `decodeTo` + `Getter.transform`:

```ts
import { Schema, SchemaGetter as Getter } from "effect"

const DateFromNumber = Schema.Number.pipe(
  Schema.decodeTo(Schema.DateValid, {
    decode: Getter.transform((n: number) => new Date(n)),
    encode: Getter.transform((d: Date) => d.getTime()),
  }),
)
```

This is 6 lines of boilerplate that every project storing dates as numbers needs. `DateFromString` should arguably stay too.

**Suggestion:** Keep `Schema.DateFromNumber` and `Schema.DateFromString` as built-in transforms, or at least export them from an `effect/unstable/schema` convenience module.

---

## 3. `PlatformError` Namespace Indirection

**Impact:** Every file using `PlatformError` in type annotations

v3: `import type { PlatformError } from "@effect/platform/Error"` — direct class import.
v4: `import { PlatformError } from "effect"` — namespace import; actual type is `PlatformError.PlatformError`.

```ts
// v3 — clean
Layer.Layer<Foo, PlatformError, Bar>

// v4 — stuttering
Layer.Layer<Foo, PlatformError.PlatformError, Bar>
```

`PlatformError.PlatformError` is a stutter. Other modules like `FileSystem.FileSystem` and `Path.Path` already have this pattern, but PlatformError is used much more frequently in error channels.

**Suggestion:** Re-export the class directly alongside the namespace, or provide a type alias.

---

## 4. `Config` Is Yieldable But Not Pipeable with Effect

**Impact:** Common pattern for optional config with fallback breaks

v3 pattern that worked cleanly:
```ts
const home = yield* Config.option(Config.string("HOME")).pipe(
  Effect.catchEager(() => Effect.succeed(Option.none())),
  Effect.map(Option.getOrElse(() => os.homedir())),
)
```

v4: `Config` is `Yieldable` (can `yield*` it) but is NOT an `Effect` — can't `.pipe(Effect.catchEager(...))`. This is confusing because it looks like an Effect and acts like one in `yield*`, but doesn't accept Effect combinators.

Workaround requires splitting into separate lines:
```ts
const maybeHome = yield* Config.option(Config.string("HOME"))
const home = Option.getOrElse(maybeHome, () => os.homedir())
```

Not terrible, but the breakage is silent — you get a confusing type error deep in the pipe chain, not a "Config is not an Effect" message.

**Suggestion:** Either make `Config` pipeable with Effect combinators, or provide a clear error message / migration path.

---

## 5. Schema Filter API More Verbose

**Impact:** Every schema with validation (int, positive, maxLength, pattern, etc.)

v3 filters were pipe-compatible and composable:
```ts
Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({ title: "Count" })
```

v4 requires `.check()` with renamed functions:
```ts
Schema.Int.check(Schema.isGreaterThan(0)).annotate({ title: "Count" })
```

Not strictly worse for simple cases, but:
- `Schema.int()` → must know to use `Schema.Int` (a pre-built schema, not a filter)
- `Schema.positive()` → must know it's `Schema.isGreaterThan(0)` (no `isPositive` shorthand)
- `Schema.maxLength(n)` → `Schema.isMaxLength(n)` (rename adds no clarity)
- `.pipe(filter1, filter2)` → `.check(filter1, filter2)` (different composition method)

**Suggestion:** Keep `Schema.positive()` / `Schema.negative()` as convenience aliases. The `is` prefix on every filter reads awkwardly: `Schema.isMaxLength` looks like a predicate (returns boolean), not a filter constructor.

---

## 6. `Stream.runFold` Lazy Initial Value

**Impact:** Every `Stream.runFold` call site

v3: `Stream.runFold("", (acc, chunk) => acc + chunk)`
v4: `Stream.runFold(() => "", (acc, chunk) => acc + chunk)`

The initial value must now be wrapped in `() =>`. This is a one-character change multiplied across every `runFold` call. The laziness rarely matters in practice (initial values are almost always constants).

---

## 7. `ServiceMap` Contravariance Makes Empty Defaults Painful

**Impact:** Any code that stores services generically (registries, providers)

`ServiceMap<in Services>` is contravariant. `ServiceMap.empty()` returns `ServiceMap<never>`. You can't assign `ServiceMap<never>` to a field typed `ServiceMap<any>` — variance goes the wrong way.

Every registry/provider that has an optional services field needs casts:
```ts
const services: ServiceMap<any> = ServiceMap.empty() as ServiceMap<any>
```

v3's `Runtime.defaultRuntime` returned something assignable to broad types. v4's `ServiceMap.empty()` doesn't.

**Suggestion:** Provide `ServiceMap.unsafeEmpty(): ServiceMap<any>` or make `empty()` return a wider type.

---

## 8. Logger API Complete Rewrite

**Impact:** Every custom logger

The Logger interface changed fundamentally:
- `LogLevel` went from tagged object (`.label`, `._tag`) to string union
- `Logger.Options` dropped `annotations` and `spans` — must access via fiber refs from `"effect/References"`
- `Logger.replace` / `Logger.zip` / `Logger.minimumLogLevel` all changed
- `Cause.isEmpty(cause)` → `cause.reasons.length > 0`

This isn't a rename — it's a full rewrite of every custom logger. The migration guide covers some renames but doesn't document the Logger interface changes.

---

## 9. `Tracer.make` Span Callback Signature Changed

**Impact:** Every custom tracer

v3: `span(name, parent, context, links, startTime, kind) => Span`
v4: `span(options) => Span` — single options object

Plus the `Span` interface itself changed (`parent: Option<AnySpan>` → `AnySpan | undefined`, `annotations: Context.Context<never>` → `ServiceMap.ServiceMap<never>`).

And `Layer.setTracer(t)` → `Layer.succeed(Tracer.Tracer, t)`.

Combined, every custom tracer needs a full rewrite.
