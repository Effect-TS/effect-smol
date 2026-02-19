# Migration Gaps — Undocumented Changes

Things that changed in v4 but aren't covered (or are insufficiently covered) in the official migration docs. Found during a real-world migration of an 11-package monorepo.

---

## Undocumented API Removals

| Removed API | Replacement | Category |
|-------------|-------------|----------|
| `Schema.DateFromNumber` | Manual `decodeTo` + `Getter.transform` | Schema |
| `Schema.DateFromString` | Manual `decodeTo` | Schema |
| `Schema.transformOrFail` | `decodeTo` with fallible Getters | Schema |
| `Schema.pattern(regex)` | `Schema.isPattern(regex)` + `.check()` | Schema |
| `Schema.int()` | `Schema.Int` (pre-built schema) | Schema |
| `Schema.positive()` | `Schema.isGreaterThan(0)` | Schema |
| `Schema.minItems(n)` | `Schema.isMinLength(n)` | Schema |
| `Schema.maxItems(n)` | `Schema.isMaxLength(n)` | Schema |
| `ParseResult` module | `Schema.SchemaError` | Schema |
| `Schema.Schema.AnyNoContext` | `Schema.Decoder<any, never>` | Schema |
| `JSONSchema.make(schema)` | `Schema.toJsonSchemaDocument(schema)` | Schema |
| `.annotations({...})` | `.annotate({...})` | Schema |
| `Schema.decodeUnknown(s)(v)` | `Schema.decodeUnknownEffect(s)(v)` | Schema |
| `Schema.Record({ key, value })` | `Schema.Record(key, value)` (positional) | Schema |
| `Layer.die(msg)` | `Layer.effectServices(Effect.die(msg))` | Layer |
| `Layer.setTracer(t)` | `Layer.succeed(Tracer.Tracer, t)` | Layer |
| `Layer.scopedDiscard(e)` | `Layer.effectDiscard(e)` | Layer |
| `Layer.Layer.Context<T>` (type utility) | Define manually | Layer |
| `Stream.unwrapScoped(e)` | `Stream.unwrap(e)` | Stream |
| `Stream.filterMap(fn)` | `Stream.filter(Filter.fromPredicateOption(fn))` | Stream |
| `Stream.fromQueue` (with Subscription) | `Stream.fromSubscription` | Stream |
| `Logger.replace(old, new)` | `Logger.layer([logger])` | Logger |
| `Logger.zip(a, b)` | `Logger.layer([a, b])` | Logger |
| `Logger.minimumLogLevel(level)` | `Layer.effectServices(...)` with `MinimumLogLevel` ref | Logger |
| `Schedule.intersect(a, b)` | `Schedule.both(a, b)` | Schedule |
| `Schedule.whileInput(pred)` | `Effect.retry({ while: pred })` | Schedule |
| `Effect.timeoutFail(opts)` | `Effect.timeoutOrElse(...)` | Effect |
| `Effect.tapErrorCause(fn)` | `Effect.tapCause(fn)` | Effect |
| `Ref.unsafeMake(v)` | `Ref.makeUnsafe(v)` | Ref |
| `globalValue` from `"effect/GlobalValue"` | Module-level lazy singleton | Core |
| `import ... from "effect/ConfigError"` | `Config.ConfigError` from `"effect"` | Core |
| `Fiber.RuntimeFiber` | `Fiber.Fiber` | Core |

## Undocumented Behavioral Changes

### `FileSystem.File.Info.mtime` Type Change

```ts
// v3: Option<Date>
Option.getOrElse(stat.mtime, () => new Date(0))

// v4: Date | undefined
stat.mtime ?? new Date(0)
```

### `Effect.tap` Requires Effect Return

v3 accepted `void` return. v4 requires `Effect` return. Not in migration docs.

### `HttpApiEndpoint` Chaining → Options API

Entire HttpApiEndpoint API changed from method chaining to options object. Not documented.

### `Entity` Handler Receives Envelope

`Entity` handlers in `effect/unstable/cluster` receive `Envelope.Request<Current>` not raw payload. Must access `.payload`.

### `RpcServer.layerHttpRouter` → `RpcServer.layerHttp`

### `HttpApiScalar.layerHttpLayerRouter` → `HttpApiScalar.layer`

### `BunRuntime.runMain` Dropped `disablePrettyLogger`

### `Command.run` Dropped `name` from Config

v4 only accepts `{ version: string }`.

---

## Type System Surprises

### `Schema.Schema<T>` Now 1 Type Param

Biggest type-level change. Every `Schema.Schema<T, E, R>` annotation needs updating:
- Read-only context: `Schema.Schema<T>`
- Encode/decode context: `Schema.Codec<T, E, RD, RE>`
- Any schema constraint: `Schema.Top`
- No-context constraint: `Schema.Decoder<any, never>` (replaces `AnyNoContext`)

### `ServiceMap` is Contravariant

`ServiceMap<in Services>` means `ServiceMap<never>` ⊄ `ServiceMap<any>`. This is the opposite of what most people expect and makes generic service containers painful.

### `PlatformError` Became a Namespace

`import { PlatformError } from "effect"` gives a namespace. The type is `PlatformError.PlatformError`. Cannot use `type` import.

### Index Signature Access on Schema.Struct Decoded Types

With `noPropertyAccessFromIndexSignature`, decoded struct types require bracket notation: `config["field"]` instead of `config.field`.

---

## Missing Migration Doc Entries

The following renames are missing from `MIGRATION.md` in this repo:

1. `Effect.tapErrorCause` → `Effect.tapCause`
2. `Effect.timeoutFail` → `Effect.timeoutOrElse`
3. `Schedule.intersect` → `Schedule.both`
4. `Schedule.whileInput` → moved to `Effect.retry({ while })`
5. `Ref.unsafeMake` → `Ref.makeUnsafe`
6. `Schema.decodeUnknown` → `Schema.decodeUnknownEffect`
7. `Schema.Record({ key, value })` → `Schema.Record(key, value)`
8. `.annotations()` → `.annotate()` (on all Schema types)
9. All Schema filter renames (`int`, `positive`, `pattern`, `maxLength`, etc.)
10. `Layer.die` removal
11. `Layer.setTracer` removal
12. `Layer.scopedDiscard` → `Layer.effectDiscard`
13. `Stream.filterMap` removal
14. `Stream.fromQueue` incompatibility with `PubSub.Subscription`
15. Logger interface rewrite
16. Tracer.make span callback signature change
17. `globalValue` removal
18. `effect/ConfigError` subpath removal
19. `Fiber.RuntimeFiber` → `Fiber.Fiber`
20. `FileSystem.File.Info.mtime` type change (`Option<Date>` → `Date | undefined`)
