# Mechanical API Renames

Safe find-replace. No surrounding context needed.

## Effect

| v3 | v4 | Notes |
|----|----|----|
| `Effect.catchAll(` | `Effect.catchEager(` | **Skip** `catchAllCause`, `catchAllDefect` |
| `Effect.catchAllCause(` | `Effect.catchCause(` | |
| `Effect.catchAllDefect(` | `Effect.catchDefect(` | |
| `Effect.either(` | `Effect.result(` | Return type: Either→Result |
| `Effect.fork(` | `Effect.forkChild(` | **Skip** `forkDaemon`, `forkScoped` |
| `Effect.forkDaemon(` | `Effect.forkDetach(` | |
| `Effect.yieldNow()` | `Effect.yieldNow` | Value, not function call |
| `Effect.dieMessage(` | `Effect.die(` | `die` now accepts `unknown` |
| `Effect.tapErrorCause(` | `Effect.tapCause(` | |
| `Effect.timeoutFail(` | `Effect.timeoutOrElse(` | |
| `Effect.zipRight(` | `Effect.andThen(` | |
| `Effect.repeatN(n)` | `Effect.repeat({ times: n })` | |
| `Effect.runtime<R>()` | `Effect.services<R>()` | Returns `ServiceMap<R>` |
| `Effect.serviceOptional(` | `Effect.serviceOption(` | Return type changes |

**Removed:** `Effect.try(() => ...)` (single-arg) — use `Effect.try({ try, catch })`. `Effect.forkAll` — removed.

## Context → ServiceMap

| v3 | v4 |
|----|----|
| `Context.Tag("id")<Self, T>()` | `ServiceMap.Service<Self, T>()("id")` |
| `Context.GenericTag<T>("id")` | `ServiceMap.Service<T>("id")` |
| `Context.make(tag, value)` | `ServiceMap.make(tag, value)` |
| `Context.get(ctx, tag)` | `ServiceMap.get(ctx, tag)` |
| `Context.Context<never>` | `ServiceMap.ServiceMap<never>` |

**Pattern:** String ID moves from first call to second; type params first to first.

```ts
// v3
class Foo extends Context.Tag("@pkg/Foo")<Foo, FooService>() {}
// v4
class Foo extends ServiceMap.Service<Foo, FooService>()("@pkg/Foo") {}
```

## Schema

| v3 | v4 | Notes |
|----|----|----|
| `Schema.TaggedError<T>()` | `Schema.TaggedErrorClass<T>()` | |
| `Schema.parseJson(S)` | `Schema.fromJsonString(S)` | |
| `Schema.Union(A, B, C)` | `Schema.Union([A, B, C])` | Array wrap |
| `Schema.Literal("a", "b")` | `Schema.Literals(["a", "b"])` | Multi-arg only |
| `Schema.encode(s)(v)` | `Schema.encodeEffect(s)(v)` | |
| `Schema.decode(s)(v)` | `Schema.decodeEffect(s)(v)` | |
| `Schema.decodeUnknown(s)(v)` | `Schema.decodeUnknownEffect(s)(v)` | |
| `.annotations({` | `.annotate({` | All schema types |
| `Schema.pattern(regex)` | `Schema.isPattern(regex)` | `.check()` |
| `Schema.maxLength(n)` | `Schema.isMaxLength(n)` | `.check()` |
| `Schema.minItems(n)` | `Schema.isMinLength(n)` | `.check()` |
| `Schema.maxItems(n)` | `Schema.isMaxLength(n)` | `.check()` |
| `Schema.int()` | `Schema.Int` | Pre-built schema |
| `Schema.positive()` | `Schema.isGreaterThan(0)` | `.check()` |
| `Schema.Record({ key, value })` | `Schema.Record(key, value)` | Positional |

### Filter pattern

```ts
// v3
Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({ title: "Count" })
// v4
Schema.Int.check(Schema.isGreaterThan(0)).annotate({ title: "Count" })
```

## Layer

| v3 | v4 | Notes |
|----|----|----|
| `Layer.scoped(tag, effect)` | `Layer.effect(tag, effect)` | Auto-strips Scope |
| `Layer.unwrapEffect(e)` | `Layer.unwrap(e)` | |
| `Layer.die(msg)` | `Layer.effectServices(Effect.die(msg))` | Removed |
| `Layer.setTracer(t)` | `Layer.succeed(Tracer.Tracer, t)` | Removed |
| `Layer.scopedDiscard(e)` | `Layer.effectDiscard(e)` | |

### Logger Layers

```ts
// v3                                  // v4
Logger.replace(default, myLogger)      Logger.layer([myLogger])
Logger.zip(a, b)                       Logger.layer([a, b])
Logger.minimumLogLevel(LogLevel.Info)  Layer.effectServices(
                                         Effect.succeed(
                                           ServiceMap.make(MinimumLogLevel, level)))
```

## Cause

| v3 | v4 |
|----|----|
| `Cause.isInterruptedOnly(c)` | `Cause.hasInterruptsOnly(c)` |
| `Cause.isFailure(c)` | `Cause.hasFails(c)` |
| `Cause.isEmpty(c)` | `c.reasons.length === 0` |
| `Cause.failures(c)` | `c.reasons.filter(Cause.isFailReason).map(r => r.error)` |

## Schedule

| v3 | v4 |
|----|----|
| `Schedule.stop` | `Schedule.recurs(0)` |
| `Schedule.driver(s)` | `Schedule.toStep(s)` |
| `Schedule.intersect(a, b)` | `Schedule.both(a, b)` |
| `Schedule.whileInput(pred)` | `Effect.retry({ while: pred })` |

## Stream

| v3 | v4 |
|----|----|
| `Stream.unwrapScoped(e)` | `Stream.unwrap(e)` |
| `Stream.filterMap(f)` | `Stream.filter(Filter.fromPredicateOption(f))` |
| `Stream.fromQueue(sub)` | `Stream.fromSubscription(sub)` (PubSub) |
| `Stream.runFold(init, f)` | `Stream.runFold(() => init, f)` |

## Fiber / Scope / Runtime / Ref

| v3 | v4 |
|----|----|
| `Fiber.interruptFork(f)` | `Fiber.interrupt(f)` (non-blocking) |
| `Fiber.RuntimeFiber` | `Fiber.Fiber` |
| `Scope.CloseableScope` | `Scope.Closeable` |
| `Runtime.Runtime<R>` | `ServiceMap.ServiceMap<R>` |
| `Runtime.runFork(rt)(eff)` | `Effect.runForkWith(services)(eff)` |
| `Runtime.defaultRuntime` | `ServiceMap.empty()` |
| `Ref.unsafeMake(v)` | `Ref.makeUnsafe(v)` |
| `Brand.Brand<unique symbol>` | `Brand.Brand<string>` |

## SubscriptionRef

| v3 | v4 |
|----|----|
| `ref.changes` | `SubscriptionRef.changes(ref)` |
| `ref.get` / `yield* ref` | `SubscriptionRef.get(ref)` |

No longer implements `Effect` — all access via static functions.

## CLI (`@effect/cli` → `"effect/unstable/cli"`)

| v3 | v4 |
|----|----|
| `Options.text("name")` | `Flag.string("name")` |
| `Options.boolean("flag")` | `Flag.boolean("flag")` |
| `Options.withAlias("x")` | `Flag.withAlias("x")` |
| `Options.optional` | `Flag.optional` |
| `Options.withDefault(v)` | `Flag.withDefault(v)` |
| `Args.text({ name: "x" })` | `Argument.string("x")` |
| `Args.optional` | `Argument.optional` |
| `Command.run(cmd, { name, version })` | `Command.run(cmd, { version })` |

## ChildProcess (`Command` → `ChildProcess`)

| v3 | v4 |
|----|----|
| `Command.make("git", ...args)` | `ChildProcess.make("git", [...args])` |
| `Command.workingDirectory(cwd)` | `ChildProcess.setCwd(cwd)` |
| `Command.start(cmd)` | `ChildProcess.spawn(cmd)` |
| `Command.string(cmd)` | `ChildProcess.string(cmd)` |

## HttpApiEndpoint (chaining → options)

```ts
// v3
HttpApiEndpoint.post("create", "/sessions")
  .setPayload(P).setPath(Schema.Struct({ id: ... })).addSuccess(S).addError(E)
// v4
HttpApiEndpoint.post("create", "/sessions", {
  payload: P, params: { id: ... }, success: S, error: E
})
```

- `.setPath()` → `params:` in options
- `HttpApiEndpoint.del()` → `HttpApiEndpoint.delete()`
- Handler `{ path }` → `{ params }`
- `HttpApiScalar.layerHttpLayerRouter({ api, path })` → `HttpApiScalar.layer(api, { path })`
- `RpcServer.layerHttpRouter(...)` → `RpcServer.layerHttp(...)`
