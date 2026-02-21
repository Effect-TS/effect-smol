# effect-v3-to-v4

JSSG codemod for migrating Effect v3 code to v4 APIs.

## How This Codemod Behaves

The codemod has three behavior classes:

- `Deterministic`: direct, safe rewrites for exact API moves/renames.
- `Heuristic`: pattern-based rewrites that are usually correct but still need manual verification.
- `Warning`: no automatic semantic rewrite; inserts TODO markers for manual migration.

## Safety Modes

The codemod supports two migration modes through `EFFECT_V4_MODE`:

- `safe` (default): conservative migration, keeps risky shapes as TODO warnings.
- `aggressive`: maximizes auto-rewrites for strict high-confidence shapes.

Run with default safe mode:

```bash
npx codemod@latest workflow run -w workflow.yaml --target .
```

Opt in to aggressive mode:

```bash
EFFECT_V4_MODE=aggressive npx codemod@latest workflow run -w workflow.yaml --target .
```

In `safe` mode, these stay warning-only instead of being auto-rewritten:

- `Effect.catchSome(...)` (except strict ternary `Option.some/Option.none` shapes)
- `Effect.catchSomeDefect(...)` (except strict ternary `Option.some/Option.none` shapes)
- `Effect.Service<...>()(id, { effect })` (effect-only shape)
- `Cause.isSequentialType(...)`, `Cause.isParallelType(...)`
- `Schema.optionalWith(schema)` (single-arg form)
- `Schema.optionalToOptional(...)`, `Schema.optionalToRequired(...)`, `Schema.requiredToOptional(...)`
- `Schema.rename(...)`
- `Schema.transform(...)`, `Schema.transformOrFail(...)`, `Schema.transformLiterals(...)`
- `Schema.filter(...)`, `Schema.pick(...)`, `Schema.omit(...)`, `Schema.partial`, `Schema.partialWith({ exact: true })`
- `Schema.extend(Schema.Struct({ ... }))`
- standalone `Schema.attachPropertySignature(key, value)`
- `Schema.TemplateLiteralParser(name)` where `name` is a bound `const name = Schema.TemplateLiteral(...)`
- yield fallback rewrites when semantic symbol resolution is unavailable

Safe-mode import behavior:

- The codemod does not add helper imports that are only needed for aggressive-only rewrites (for example `Struct`, `SchemaGetter`, `SchemaTransformation`, `Filter`) unless those symbols are already used by existing code.
- This avoids import churn in files where safe mode intentionally leaves TODO markers.

Common deterministic rewrite examples (some are `aggressive`-only as noted in Safety Modes):

- `Effect.catchAll` -> `Effect.catch`
- `Effect.catchAllCause` -> `Effect.catchCause`
- `Effect.fork` -> `Effect.forkChild`
- `Effect.forkDaemon` -> `Effect.forkDetach`
- `Effect.catchSome((e) => cond ? Option.some(handler) : Option.none())` -> `Effect.catchFilter(Filter.fromPredicate((e) => cond), (e) => handler)`
- `Effect.catchSomeDefect((d) => cond ? Option.some(handler) : Option.none())` -> `Effect.catchDefect((d) => cond ? handler : Effect.die(d))`
- `Scope.extend(effect, scope)` -> `Scope.provide(scope)(effect)`
- `FiberRef.get(FiberRef.currentLogLevel)` -> `References.CurrentLogLevel`
- `Effect.locally(effect, FiberRef.currentLogLevel, LogLevel.Debug)` -> `Effect.provideService(effect, References.CurrentLogLevel, "Debug")`
- `Cause.isFailType(cause)` -> `Cause.isFailReason(cause)`
- `Context.GenericTag` / `Context.Tag` / `Effect.Tag` -> `ServiceMap.*` equivalents
- `Schema.Union(a, b)` -> `Schema.Union([a, b])`
- `Schema.Record({ key, value })` -> `Schema.Record(key, value)`
- `Schema.pattern(/x/)` -> `Schema.check(Schema.isPattern(/x/))`
- `Schema.transformLiteral(0, "a")` -> `Schema.Literal(0).transform("a")`
- `Schema.Literal("a", "b", "c").pipe(Schema.pickLiteral("a", "b"))` -> `Schema.Literals(["a", "b", "c"]).pick(["a", "b"])`
- `Schema.TemplateLiteralParser(Schema.String, ".", Schema.String)` -> `Schema.TemplateLiteralParser([Schema.String, ".", Schema.String])`
- `const t = Schema.TemplateLiteral(...); Schema.TemplateLiteralParser(t)` -> `Schema.TemplateLiteralParser(t.parts)`
- `Effect.Service<Service>()("Id", { effect: make })` -> `ServiceMap.Service<Service>()("Id", { make })`
- `Schema.optionalWith(schema, { exact: true })` -> `Schema.optionalKey(schema)`
- `schema.pipe(Schema.attachPropertySignature("kind", "circle"))` -> `schema.mapFields((fields) => ({ ...fields, "kind": Schema.tagDefaultOmit("circle") }))`
- `schema.annotations({ decodingFallback: () => Effect.succeed("a") })` -> `schema.pipe(Schema.catchDecoding(() => Effect.succeedSome("a")))`
- `Cause.isSequentialType(cause)` -> `false`
- `Cause.isParallelType(cause)` -> `false`
- `Schema.filter(predicate)` -> `Schema.check(Schema.makeFilter(predicate))`
- `Schema.pick("a")` -> `Struct.pick(["a"])`
- `Schema.omit("a")` -> `Struct.omit(["a"])`
- `Schema.partial` -> `Struct.map(Schema.optional)`
- `Schema.optionalWith(schema)` -> `Schema.optional(schema)`
- `Schema.rename({ a: "b" })` -> `Schema.encodeKeys({ a: "b" })`
- `yield* ref` -> `yield* Ref.get(ref)` for known `Ref.make` bindings

Warning annotation format is fixed:

- `/* TODO(effect-v4-codemod): manual migration required for <rule-id> */`

## Exact Pattern Matrix

Patterns below are the exact migration contracts implemented by this codemod.
Anything not listed is left unchanged (or explicitly warned).

### Auto-Applied Deterministic Patterns

`Effect.*` member renames:

- `Effect.catchAll -> Effect.catch`
- `Effect.catchAllCause -> Effect.catchCause`
- `Effect.catchAllDefect -> Effect.catchDefect`
- `Effect.catchSomeCause -> Effect.catchCauseFilter`
- `Effect.fork -> Effect.forkChild`
- `Effect.forkDaemon -> Effect.forkDetach`

`Scope` / `Equal`:

- `Scope.extend -> Scope.provide` (member rename)
- `Equal.equivalence -> Equal.asEquivalence`

`Context -> ServiceMap` member renames:

- `Context.GenericTag -> ServiceMap.Service`
- `Context.make -> ServiceMap.make`
- `Context.get -> ServiceMap.get`
- `Context.add -> ServiceMap.add`
- `Context.mergeAll -> ServiceMap.mergeAll`

`Cause.*` member renames:

- `Cause.isFailure -> Cause.hasFails`
- `Cause.isDie -> Cause.hasDies`
- `Cause.isInterrupted -> Cause.hasInterrupts`
- `Cause.isInterruptedOnly -> Cause.hasInterruptsOnly`
- `Cause.isFailType -> Cause.isFailReason`
- `Cause.isDieType -> Cause.isDieReason`
- `Cause.isInterruptType -> Cause.isInterruptReason`
- `Cause.sequential -> Cause.combine`
- `Cause.parallel -> Cause.combine`
- `Cause.failureOption -> Cause.findErrorOption`
- `Cause.failureOrCause -> Cause.findError`
- `Cause.dieOption -> Cause.findDefect`
- `Cause.interruptOption -> Cause.findInterrupt`
- `Cause.NoSuchElementException -> Cause.NoSuchElementError`
- `Cause.TimeoutException -> Cause.TimeoutError`
- `Cause.IllegalArgumentException -> Cause.IllegalArgumentError`
- `Cause.ExceededCapacityException -> Cause.ExceededCapacityError`
- `Cause.UnknownException -> Cause.UnknownError`
- `Cause.isNoSuchElementException -> Cause.isNoSuchElementError`
- `Cause.isTimeoutException -> Cause.isTimeoutError`
- `Cause.isIllegalArgumentException -> Cause.isIllegalArgumentError`
- `Cause.isExceededCapacityException -> Cause.isExceededCapacityError`
- `Cause.isUnknownException -> Cause.isUnknownError`

`Schema.*` member renames:

- `Schema.asSchema -> Schema.revealCodec`
- `Schema.encodedSchema -> Schema.toEncoded`
- `Schema.typeSchema -> Schema.toType`
- `Schema.compose -> Schema.decodeTo`
- `Schema.annotations -> Schema.annotate`
- `Schema.decodeUnknown -> Schema.decodeUnknownEffect`
- `Schema.decode -> Schema.decodeEffect`
- `Schema.decodeUnknownEither -> Schema.decodeUnknownResult`
- `Schema.decodeEither -> Schema.decodeResult`
- `Schema.encodeUnknown -> Schema.encodeUnknownEffect`
- `Schema.encode -> Schema.encodeEffect`
- `Schema.encodeUnknownEither -> Schema.encodeUnknownResult`
- `Schema.encodeEither -> Schema.encodeResult`
- `Schema.BigIntFromSelf -> Schema.BigInt`
- `Schema.SymbolFromSelf -> Schema.Symbol`
- `Schema.URLFromSelf -> Schema.URL`
- `Schema.RedactedFromSelf -> Schema.Redacted`
- `Schema.Redacted -> Schema.RedactedFromValue`

`FiberRef.* -> References.*` member renames:

- `FiberRef.currentConcurrency -> References.CurrentConcurrency`
- `FiberRef.currentLogLevel -> References.CurrentLogLevel`
- `FiberRef.currentMinimumLogLevel -> References.MinimumLogLevel`
- `FiberRef.currentLogAnnotations -> References.CurrentLogAnnotations`
- `FiberRef.currentLogSpan -> References.CurrentLogSpans`
- `FiberRef.currentScheduler -> References.Scheduler`
- `FiberRef.currentMaxOpsBeforeYield -> References.MaxOpsBeforeYield`
- `FiberRef.currentTracerEnabled -> References.TracerEnabled`
- `FiberRef.unhandledErrorLogLevel -> References.UnhandledLogLevel`

Deterministic call-shape rewrites (includes aggressive-only shapes):

- `Context.Tag("UserRepo")<UserRepo, { readonly findById: (id: string) => Effect.Effect<User> }>() -> ServiceMap.Service<UserRepo, { readonly findById: (id: string) => Effect.Effect<User> }>()("UserRepo")`
- `Effect.Tag("Clock")<Clock, { readonly now: Effect.Effect<number> }>() -> ServiceMap.Service<Clock, { readonly now: Effect.Effect<number> }>()("Clock")`
- `Context.Reference<Config>()("Config", { defaultValue: { apiBaseUrl: "https://api.example.com" } }) -> ServiceMap.Reference<Config>("Config", { defaultValue: { apiBaseUrl: "https://api.example.com" } })`
- `Context.Reference<Config>()("Config") -> ServiceMap.Reference<Config>("Config")`
- `Effect.catchSome((e) => cond ? Option.some(handler) : Option.none()) -> Effect.catchFilter(Filter.fromPredicate((e) => cond), (e) => handler)` (and equivalent negated branch form)
- `Effect.catchSomeDefect((d) => cond ? Option.some(handler) : Option.none()) -> Effect.catchDefect((d) => cond ? handler : Effect.die(d))` (and equivalent negated branch form)
- `Effect.Service<Service>()("Id", { effect: make }) -> ServiceMap.Service<Service>()("Id", { make })`
- `Cause.isEmptyType(cause) -> cause.reasons.length === 0`
- `Cause.isSequentialType(cause) -> false`
- `Cause.isParallelType(cause) -> false`
- `Cause.failures(cause) -> cause.reasons.filter(Cause.isFailReason)`
- `Cause.defects(cause) -> cause.reasons.filter(Cause.isDieReason)`
- `Scope.extend(program, scope) -> Scope.provide(scope)(program)`
- `FiberRef.get(FiberRef.currentLogLevel) -> References.CurrentLogLevel` (same mapping style for the other renamed FiberRef references)
- `Effect.locally(program, FiberRef.currentLogLevel, "Debug") -> Effect.provideService(program, References.CurrentLogLevel, "Debug")`
- `Schema.parseJson() -> Schema.UnknownFromJsonString`
- `Schema.parseJson(UserSchema) -> Schema.fromJsonString(UserSchema)`
- `Schema.pattern(/[a-z]+/) -> Schema.check(Schema.isPattern(/[a-z]+/))`
- `Schema.transformLiteral("v3", "v4") -> Schema.Literal("v3").transform("v4")`
- `Schema.Literal("a", "b", "c").pipe(Schema.pickLiteral("a", "b")) -> Schema.Literals(["a", "b", "c"]).pick(["a", "b"])`
- `Schema.TemplateLiteralParser(Schema.String, ".", Schema.String) -> Schema.TemplateLiteralParser([Schema.String, ".", Schema.String])`
- `const template = Schema.TemplateLiteral(...); Schema.TemplateLiteralParser(template) -> Schema.TemplateLiteralParser(template.parts)`
- `Schema.Union(Schema.String, Schema.Number) -> Schema.Union([Schema.String, Schema.Number])`
- `Schema.Tuple(Schema.String, Schema.Number) -> Schema.Tuple([Schema.String, Schema.Number])`
- `Schema.TemplateLiteral("user-", Schema.String) -> Schema.TemplateLiteral(["user-", Schema.String])`
- `Schema.Record({ key: Schema.String, value: Schema.Number }) -> Schema.Record(Schema.String, Schema.Number)`
- `Schema.Record({ value: Schema.Number, key: Schema.String }) -> Schema.Record(Schema.String, Schema.Number)`
- `Schema.optionalWith(Schema.NumberFromString, { exact: true }) -> Schema.optionalKey(Schema.NumberFromString)`
- `Schema.optionalWith(Schema.NumberFromString) -> Schema.optional(Schema.NumberFromString)`
- `Schema.optionalToOptional(from, to, options) -> Schema.optionalKey(from).pipe(Schema.decodeTo(Schema.optionalKey(to), { decode: SchemaGetter.transformOptional(options.decode), encode: SchemaGetter.transformOptional(options.encode) }))`
- `Schema.optionalToRequired(from, to, options) -> Schema.optionalKey(from).pipe(Schema.decodeTo(to, { decode: SchemaGetter.transformOptional(options.decode), encode: SchemaGetter.transformOptional(options.encode) }))`
- `Schema.requiredToOptional(from, to, options) -> from.pipe(Schema.decodeTo(Schema.optionalKey(to), { decode: SchemaGetter.transformOptional(options.decode), encode: SchemaGetter.transformOptional(options.encode) }))`
- `Schema.rename(mapping) -> Schema.encodeKeys(mapping)`
- `Schema.transform(from, to, options) -> from.pipe(Schema.decodeTo(to, SchemaTransformation.transform({ decode: options.decode, encode: options.encode })))`
- `Schema.transformOrFail(from, to, options) -> from.pipe(Schema.decodeTo(to, SchemaTransformation.transformOrFail({ decode: options.decode, encode: options.encode })))`
- `Schema.transformLiterals(pairA, pairB) -> Schema.Literals([pairA[0], pairB[0]]).transform([pairA[1], pairB[1]])`
- `Schema.Struct({ radius: Schema.Number }).pipe(Schema.attachPropertySignature("kind", "circle")) -> Schema.Struct({ radius: Schema.Number }).mapFields((fields) => ({ ...fields, "kind": Schema.tagDefaultOmit("circle") }))`
- `Schema.attachPropertySignature("kind", "circle") -> (schema) => schema.mapFields((fields) => ({ ...fields, "kind": Schema.tagDefaultOmit("circle") }))`
- `Schema.filter(predicate) -> Schema.check(Schema.makeFilter(predicate))`
- `Schema.pick("a", "b") -> Struct.pick(["a", "b"])`
- `Schema.omit("a", "b") -> Struct.omit(["a", "b"])`
- `Schema.partial -> Struct.map(Schema.optional)`
- `Schema.partialWith({ exact: true }) -> Struct.map(Schema.optionalKey)`
- `Schema.extend(Schema.Struct({ a: Schema.String })) -> Schema.fieldsAssign({ a: Schema.String })`
- `Schema.String.annotations({ decodingFallback: () => Effect.succeed("a") }) -> Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedSome("a")))`
- `Schema.Literal(null) -> Schema.Null`
- `Schema.Literal("a", "b", "c") -> Schema.Literals(["a", "b", "c"])`

Yieldable rewrites:

- If `const x = yield* Ref.make(...)` and later `yield* x` (unambiguous), rewrite to `yield* Ref.get(x)`.
- If `const x = yield* Deferred.make(...)` and later `yield* x` (unambiguous), rewrite to `yield* Deferred.await(x)`.
- If `const x = yield* Effect.fork* (...)` and later `yield* x` (unambiguous), rewrite to `yield* Fiber.join(x)`.

### Heuristic Patterns (Auto-Rewritten, Must Be Manually Reviewed)

- `yield* variable` rewrites when semantic symbol resolution is unavailable and fallback local-binding inference is used.
  - The deterministic path uses symbol definition lookup.
  - The fallback path only rewrites when there is exactly one matching const binding for that variable in the file.
  - This fallback is enabled only in `aggressive` mode.

### Manual-Only / Warning Patterns (No Safe Auto Migration)

For these exact patterns, codemod only inserts TODO warnings:

- `effect-catchSome`: `Effect.catchSome(...)` when shape is not strict ternary `Option.some(...) : Option.none()` (or the negated branch equivalent)
- `effect-catchSomeDefect-removed`: `Effect.catchSomeDefect(...)` when shape is not strict ternary `Option.some(...) : Option.none()` (or the negated branch equivalent)
- `effect-forkAll-removed`: `Effect.forkAll(...)` (any arguments)
- `effect-forkWithErrorHandler-removed`: `Effect.forkWithErrorHandler(...)` (any arguments)
- `fiberref-set-manual`: `FiberRef.set(...)` (any arguments)
- `effect-service-manual`: `Effect.Service(...)` when shape is not exact `Effect.Service<...>()(id, { effect: make })`
- `services-context-reference-class-manual`: `class AppConfig extends Context.Reference<Config>()("AppConfig", { defaultValue: ... }) {}`
- `schema-optionalWith-manual`: `Schema.optionalWith(...)` when options are present and not the exact shape `{ exact: true }`
- `schema-optionalToOptional-manual`: `Schema.optionalToOptional(...)` when shape is not `(from, to, options)`
- `schema-optionalToRequired-manual`: `Schema.optionalToRequired(...)` when shape is not `(from, to, options)`
- `schema-requiredToOptional-manual`: `Schema.requiredToOptional(...)` when shape is not `(from, to, options)`
- `schema-transformOrFail-manual`: `Schema.transformOrFail(...)` when shape is not `(from, to, options)`
- `schema-transform-manual`: `Schema.transform(...)` when shape is not `(from, to, options)`
- `schema-templateLiteralParser-manual`: `Schema.TemplateLiteralParser(arg)` when `arg` is not `schema.parts`, not an array literal, and not an identifier bound to `const arg = Schema.TemplateLiteral(...)`
- `schema-attachPropertySignature-manual`: `Schema.attachPropertySignature(...)` when shape is not two-argument `(key, value)` form
- `schema-partialWith-manual`: `Schema.partialWith(...)` when options are not the exact shape `{ exact: true }`
- `schema-extend-manual`: `Schema.extend(...)` when right-hand side is not `Schema.Struct({ ... })`
- `schema-decodingFallback-manual`: `SomeSchema.annotations({ decodingFallback: ... })` (except `() => Effect.succeed(value)`)

## Manual Review Required

The codemod output should always be reviewed for:

- Heuristic rewrites: `yield* variable` fallback conversions in files where semantic symbol resolution is unavailable.
- Warning markers (`TODO(effect-v4-codemod)`): explicit manual migration decisions.

Review priority:

1. Resolve every `TODO(effect-v4-codemod)` marker using surrounding business logic.
2. Validate behavior for heuristic rewrites (`yield* variable` fallback cases).

## License

MIT
