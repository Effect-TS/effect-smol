# Structural Changes

Context-dependent rewrites. Not safe as blind find-replace.

## Schema Type System

| Type | Use When | Params |
|------|----------|--------|
| `Schema.Schema<T>` | Only care about decoded type | 1 |
| `Schema.Codec<T, E, RD, RE>` | Need encode/decode with services | 4 |
| `Schema.Decoder<T, RD>` | Decode-only | 2 |
| `Schema.Encoder<E, RE>` | Encode-only | 2 |
| `Schema.Decoder<any, never>` | Replaces `Schema.Schema.AnyNoContext` | — |
| `Schema.Top` | Replaces `Schema.Schema.All` / `Schema.Schema.Any` | — |

### The `unknown` leak

`Schema.Schema<T>` leaves services as `unknown`. Functions calling `encodeSync`/`decodeUnknownSync` need `never`.

```ts
// BROKEN — DecodingServices = unknown
const schema: Schema.Schema<MyType> = ...
Schema.encodeSync(schema)(value) // ERROR

// FIX
const schema: Schema.Codec<MyType, unknown, never, never> = ...
Schema.encodeSync(schema)(value) // works
```

### DateFromNumber (define locally)

```ts
import { Schema, SchemaGetter as Getter } from "effect"

const DateFromNumber = Schema.Number.pipe(
  Schema.decodeTo(Schema.DateValid, {
    decode: Getter.transform((n: number) => new Date(n)),
    encode: Getter.transform((d: Date) => d.getTime()),
  }),
)
```

## Either → Result

| v3 | v4 |
|----|----|
| `Left` / `Right` | `Failure` / `Success` |
| `.left` / `.right` | `.failure` / `.success` |
| `Either.isLeft(r)` | `Result.isFailure(r)` |
| `Effect.either(e)` | `Effect.result(e)` |

## Runtime Removal

```ts
// v3
const runtime = yield* Effect.runtime<MyServices>()
Runtime.runFork(runtime)(someEffect)

// v4
const services = yield* Effect.services<MyServices>()
Effect.runForkWith(services)(someEffect)
```

## Cause Flattening

No longer a tree. Flat: `cause.reasons: ReadonlyArray<Reason>`.

```ts
// v3 — switch on _tag (Fail, Die, Interrupt, Sequential, Parallel)
// v4 — filter reasons
const fails = cause.reasons.filter(Cause.isFailReason).map(r => r.error)
const dies = cause.reasons.filter(Cause.isDieReason).map(r => r.defect)
const interrupts = cause.reasons.filter(Cause.isInterruptReason)
```

## Logger Interface

- `LogLevel`: tagged object → string union (`"Trace" | "Debug" | "Info" | ...`)
- `logLevel.label` → just `logLevel` (IS the label)
- `annotations`/`spans` → access via fiber refs from `"effect/References"`

```ts
// v3
Logger.make(({ logLevel, message, annotations, cause }) => {
  console.log(`[${logLevel.label}] ${message}`)
  if (!Cause.isEmpty(cause)) ...
  HashMap.forEach(annotations, (v, k) => ...)
})

// v4
import { CurrentLogAnnotations, MinimumLogLevel } from "effect/References"
Logger.make(({ logLevel, message, cause, fiber }) => {
  console.log(`[${logLevel}] ${message}`)
  if (cause.reasons.length > 0) ...
  const annotations = fiber.getRef(CurrentLogAnnotations)
})
```

## Tracer.Span

```ts
// v3 Span                         // v4 Span
parent: Option<AnySpan>            parent: AnySpan | undefined
annotations: Context.Context<never> annotations: ServiceMap.ServiceMap<never>
```

`Tracer.make` — positional args → options object:

```ts
// v3
span: (name, parent, context, links, startTime, kind) => ...
// v4
span: (options) => ...
```

`Layer.setTracer(t)` → `Layer.succeed(Tracer.Tracer, t)`

## Effect.serviceOption

```ts
// v3: service stays in R
Effect.serviceOptional(Tag) // Effect<S, NoSuchElementException, Tag>
// v4: service NOT in R
Effect.serviceOption(Tag)   // Effect<Option<S>>
```

## Config.option

`Config` is `Yieldable` but NOT an `Effect`. Can't pipe Effect combinators.

```ts
// BROKEN
yield* Config.option(Config.string("HOME")).pipe(Effect.catchEager(...))
// FIX
const maybeHome = yield* Config.option(Config.string("HOME"))
const home = Option.getOrElse(maybeHome, () => os.homedir())
```

## HttpApiEndpoint (chaining → options)

```ts
// v3: .setPayload(P).setPath(S).addSuccess(T).addError(E)
// v4: { payload: P, params: S, success: T, error: E }
```

Handler `{ path }` → `{ params }`.

## Entity / RPC (cluster)

Handler receives `Envelope.Request<Current>`, not raw payload:

```ts
// v3: handler: (request) => request.payload.message
// v4: handler: (envelope) => envelope.payload.message
```

## FileSystem.File.Info.mtime

```ts
// v3: Option<Date>     →  Option.getOrElse(stat.mtime, () => new Date(0))
// v4: Date | undefined  →  stat.mtime ?? new Date(0)
```

## Testing

```ts
// v3: Effect.provide(TestContext.TestContext)
// v4: Effect.provide(TestClock.layer())  // from "effect/testing"
```

No unified `TestContext`. Provide test layers individually.
