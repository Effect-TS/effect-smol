# effect

## 4.0.0-beta.22

### Patch Changes

- [#1578](https://github.com/Effect-TS/effect-smol/pull/1578) [`0874332`](https://github.com/Effect-TS/effect-smol/commit/0874332f7c81118b06ac2eb105e0710211631479) Thanks @tim-smart! - Proxy function arity from `Effect.fn` APIs so wrapped functions preserve the original `length` value.

- [#1580](https://github.com/Effect-TS/effect-smol/pull/1580) [`c592dcd`](https://github.com/Effect-TS/effect-smol/commit/c592dcde0697e322065c8f418c0480ef910cb183) Thanks @tim-smart! - simplify Filter by removing Args type parameter

- [#1575](https://github.com/Effect-TS/effect-smol/pull/1575) [`1dbe28d`](https://github.com/Effect-TS/effect-smol/commit/1dbe28dac8299cd3e218c9768450cfd173b5e294) Thanks @tim-smart! - fix Chat constructor types

- [#1581](https://github.com/Effect-TS/effect-smol/pull/1581) [`564d730`](https://github.com/Effect-TS/effect-smol/commit/564d730b6bbf38dd8548a3b046e7a693b28699a4) Thanks @tim-smart! - fix Duration.toMillis regression

- [#1579](https://github.com/Effect-TS/effect-smol/pull/1579) [`3cfadc4`](https://github.com/Effect-TS/effect-smol/commit/3cfadc458b070c6cba6c5674b72a059f1e49118b) Thanks @tim-smart! - Remove fiber-level keep-alive intervals and keep the process alive from `Runtime.makeRunMain` instead.

- [#1571](https://github.com/Effect-TS/effect-smol/pull/1571) [`6634fd0`](https://github.com/Effect-TS/effect-smol/commit/6634fd07da067d80b8261fb2959d1a952b9e412e) Thanks @tim-smart! - Add `HttpApiClient.urlBuilder` for type-safe endpoint URL construction from group + method/path keys.

- [#1573](https://github.com/Effect-TS/effect-smol/pull/1573) [`d10dabe`](https://github.com/Effect-TS/effect-smol/commit/d10dabeb7af9a368f995829cd36ad08167cd8f95) Thanks @tim-smart! - Expose a `chunkSize` option on `Stream.fromIterable` to control emitted chunk boundaries when constructing streams from iterables.

- [#1574](https://github.com/Effect-TS/effect-smol/pull/1574) [`f82f549`](https://github.com/Effect-TS/effect-smol/commit/f82f549a09e950e9d4987f279a800f4d953f0939) Thanks @tim-smart! - Fix AI tool handler error typing so `LanguageModel.generateText` with a toolkit exposes wrapped `AiError` values rather than leaking raw `AiErrorReason` in the error channel.

- [#1577](https://github.com/Effect-TS/effect-smol/pull/1577) [`78a3382`](https://github.com/Effect-TS/effect-smol/commit/78a3382ddfbe034408f7480fa794733d9e82147b) Thanks @tim-smart! - fix VariantSchema.Union

## 4.0.0-beta.21

### Patch Changes

- [#1555](https://github.com/Effect-TS/effect-smol/pull/1555) [`e691909`](https://github.com/Effect-TS/effect-smol/commit/e691909495ccb162ea7bfa351dd74632b99997cb) Thanks @tim-smart! - fix Stream.withSpan options

- [#1548](https://github.com/Effect-TS/effect-smol/pull/1548) [`d5f413f`](https://github.com/Effect-TS/effect-smol/commit/d5f413f3c8fc57f2413cc5649c2003d6d4e5a6d7) Thanks @effect-bot! - Fix `TxPubSub.publish` and `TxPubSub.publishAll` overloads to require `Effect.Transaction` in their return environment.

- [#1557](https://github.com/Effect-TS/effect-smol/pull/1557) [`139d152`](https://github.com/Effect-TS/effect-smol/commit/139d152941e562a073b5be12e8d66c8a4d4a8a57) Thanks @A386official! - Fix MCP resource template parameter names resolving as `param0`, `param1` instead of actual names by checking `isParam` on the original schema before `toCodecStringTree` transformation.

- [#1547](https://github.com/Effect-TS/effect-smol/pull/1547) [`947e3d4`](https://github.com/Effect-TS/effect-smol/commit/947e3d436ab8a017efda9b29be523efd1ca8df28) Thanks @effect-bot! - Fix `Schedule.reduce` to persist state updates when the combine function returns a synchronous value.

- [#1545](https://github.com/Effect-TS/effect-smol/pull/1545) [`84b2cce`](https://github.com/Effect-TS/effect-smol/commit/84b2ccefe2aa3a7413b86738a4dc33cdb311ca55) Thanks @effect-bot! - Fix TupleWithRest post-rest validation to check each tail index sequentially.

- [#1552](https://github.com/Effect-TS/effect-smol/pull/1552) [`7f5305e`](https://github.com/Effect-TS/effect-smol/commit/7f5305e69f5a33309e77b08a576edb25d7daaee2) Thanks @tim-smart! - Constrain `HttpServerRequest.source` to `object` and key server-side request weak caches by `request.source` so middleware request wrappers share the same cache entries.

- [#1556](https://github.com/Effect-TS/effect-smol/pull/1556) [`9e6fd84`](https://github.com/Effect-TS/effect-smol/commit/9e6fd8471c93a3c643929151a3bdb62cb9c0ca0e) Thanks @tim-smart! - rename WorkflowEngine.layer

- [#1558](https://github.com/Effect-TS/effect-smol/pull/1558) [`fdb8a4b`](https://github.com/Effect-TS/effect-smol/commit/fdb8a4b172721fbefe98bd5aa6fe4f0efd1da3eb) Thanks @tim-smart! - Fix `Workflow.executionId` to use schema `makeUnsafe` instead of the removed `.make` API.

- [#1553](https://github.com/Effect-TS/effect-smol/pull/1553) [`0f986ef`](https://github.com/Effect-TS/effect-smol/commit/0f986ef22f196fe091a7afdbd179485a7d888882) Thanks @kaylynb! - Fix spans never having parent span

- [#1541](https://github.com/Effect-TS/effect-smol/pull/1541) [`9355fc0`](https://github.com/Effect-TS/effect-smol/commit/9355fc0ffb5b7382146a5aed9eea83974b10d007) Thanks @tim-smart! - Add `Effect.findFirst` and `Effect.findFirstFilter` for short-circuiting effectful searches over iterables.

## 4.0.0-beta.20

### Patch Changes

- [#1533](https://github.com/Effect-TS/effect-smol/pull/1533) [`842a624`](https://github.com/Effect-TS/effect-smol/commit/842a624f79d5e1407460b0ef3ab27d14d48ccf74) Thanks @tim-smart! - move ChildProcess apis into spawner service

- [#1536](https://github.com/Effect-TS/effect-smol/pull/1536) [`4785eef`](https://github.com/Effect-TS/effect-smol/commit/4785eef5d7cf1edb96ef2509aed2ba4d1edf3862) Thanks @tim-smart! - add ServiceMap.Key type, used a base for ServiceMap.Service and ServiceMap.Reference

- [#1531](https://github.com/Effect-TS/effect-smol/pull/1531) [`8fac95b`](https://github.com/Effect-TS/effect-smol/commit/8fac95bd9e0338b7a82da8da579c1ac22afa045c) Thanks @gcanti! - Revert `Config.withDefault` to v3 behavior, closes #1530.

  Make `Config.withDefault` accept an eager value instead of `LazyArg`, aligning with CLI module conventions.

- [#1535](https://github.com/Effect-TS/effect-smol/pull/1535) [`12ee8e2`](https://github.com/Effect-TS/effect-smol/commit/12ee8e27df7eb393d83a5e403390d0cfc82ca732) Thanks @tim-smart! - change default ErrorReporter severity to Info

- [#1529](https://github.com/Effect-TS/effect-smol/pull/1529) [`e542c94`](https://github.com/Effect-TS/effect-smol/commit/e542c942bee4729138b02222f4421220a90a57d8) Thanks @tim-smart! - Add dedicated AiError metadata interfaces per reason so provider packages can safely augment metadata without conflicting module declarations.

- [#1531](https://github.com/Effect-TS/effect-smol/pull/1531) [`8fac95b`](https://github.com/Effect-TS/effect-smol/commit/8fac95bd9e0338b7a82da8da579c1ac22afa045c) Thanks @gcanti! - Fix `Config.withDefault` type inference, closes #1530.

- [#1528](https://github.com/Effect-TS/effect-smol/pull/1528) [`6f4ebd1`](https://github.com/Effect-TS/effect-smol/commit/6f4ebd193c2595983394127dd808601b75430d34) Thanks @tim-smart! - Add `Model.ModelName` and provide it from AI model constructors.

- [#1537](https://github.com/Effect-TS/effect-smol/pull/1537) [`989d1cc`](https://github.com/Effect-TS/effect-smol/commit/989d1cca936fce0cc459057825ba40e3f5ef3827) Thanks @tim-smart! - Revert `Effect.partition` to Effect v3 behavior by accumulating failures from the effect error channel and never failing.

## 4.0.0-beta.19

## 4.0.0-beta.18

### Minor Changes

- [#1515](https://github.com/Effect-TS/effect-smol/pull/1515) [`01e31fd`](https://github.com/Effect-TS/effect-smol/commit/01e31fdf8e5206849d23cbafd23a346f2f177ab8) Thanks @mikearnaldi! - Add transactional STM modules: TxDeferred, TxPriorityQueue, TxPubSub, TxReentrantLock, TxSubscriptionRef.

  Refactor transaction model: remove `Effect.atomic`/`Effect.atomicWith`, add `Effect.withTxState`. All Tx operations now return `Effect<A, E, Transaction>` requiring explicit `Effect.transaction(...)` at boundaries.

  Expose `TxPubSub.acquireSubscriber`/`releaseSubscriber` for composable transaction boundaries. Fix `TxSubscriptionRef.changes` race condition ensuring current value is delivered first.

  Remove `TxRandom` module.

### Patch Changes

- [#1518](https://github.com/Effect-TS/effect-smol/pull/1518) [`0890aab`](https://github.com/Effect-TS/effect-smol/commit/0890aab15ed9c5ba52c383a72fdc6a444d7504d5) Thanks @IMax153! - Fix `Command.withGlobalFlags` type inference when mixing `GlobalFlag.action` and `GlobalFlag.setting`.

  `Setting` service identifiers are now correctly removed from command requirements in mixed global flag arrays.

- [#1520](https://github.com/Effect-TS/effect-smol/pull/1520) [`725260b`](https://github.com/Effect-TS/effect-smol/commit/725260b53f5142d6af7a93a2f9f464f974eda92d) Thanks @IMax153! - Ensure that OpenAI JSON schemas for tool calls and structured outputs are properly transformed

## 4.0.0-beta.17

### Patch Changes

- [#1516](https://github.com/Effect-TS/effect-smol/pull/1516) [`8f59c32`](https://github.com/Effect-TS/effect-smol/commit/8f59c32922597a48392744f7203e284866747781) Thanks @gcanti! - Fix `Schema.encodeKeys` to encode non-remapped struct fields during encoding.

## 4.0.0-beta.16

### Patch Changes

- [#1513](https://github.com/Effect-TS/effect-smol/pull/1513) [`bf9096c`](https://github.com/Effect-TS/effect-smol/commit/bf9096c52a7d8791d93d232739e523eb84f6625a) Thanks @gcanti! - Add `SchemaParser.makeOption` and `Schema.makeOption` for constructing schema values as `Option`.

- [#1508](https://github.com/Effect-TS/effect-smol/pull/1508) [`29f81ca`](https://github.com/Effect-TS/effect-smol/commit/29f81ca07c67dba265804b140a7487fb15a5fc6b) Thanks @gcanti! - Schema: add `OptionFromUndefinedOr` and `OptionFromNullishOr` schemas.

- [#1498](https://github.com/Effect-TS/effect-smol/pull/1498) [`68eb28c`](https://github.com/Effect-TS/effect-smol/commit/68eb28c2b0fc67a9f6204ade9bd16c5b37803bfb) Thanks @kaylynb! - Fix OpenApi Multipart file upload schema generation

## 4.0.0-beta.15

### Patch Changes

- [#1500](https://github.com/Effect-TS/effect-smol/pull/1500) [`24ae609`](https://github.com/Effect-TS/effect-smol/commit/24ae60995d2fd7d621be356cdfdfd328c79639ba) Thanks @qadama831! - Unwrap `_Success` schema to enable field access.

- [#1486](https://github.com/Effect-TS/effect-smol/pull/1486) [`0e3c059`](https://github.com/Effect-TS/effect-smol/commit/0e3c059987caa55ebd0c134f7c7b147c639c328e) Thanks @tim-smart! - Fix `Stream.groupedWithin` to stop emitting empty arrays when schedule ticks fire while upstream is idle.

- [#1503](https://github.com/Effect-TS/effect-smol/pull/1503) [`e843b0a`](https://github.com/Effect-TS/effect-smol/commit/e843b0a7d7e7b600a0b3bd477f24e2e4cd26bc8b) Thanks @tim-smart! - allow creating standalone http handlers from HttpApiEndpoints

- [#1499](https://github.com/Effect-TS/effect-smol/pull/1499) [`f4389a2`](https://github.com/Effect-TS/effect-smol/commit/f4389a2cca3c5bbf00d69779f52ce41255f15a28) Thanks @tim-smart! - fix atom node timeout cleanup

- [#1494](https://github.com/Effect-TS/effect-smol/pull/1494) [`5b73de0`](https://github.com/Effect-TS/effect-smol/commit/5b73de095b3402d0c5c74092ace6ce18ebfad566) - Refine `ExtractServices` to omit tool handler requirements when automatic tool resolution is explicitly disabled through the `disableToolCallResolution` option.

- [#1496](https://github.com/Effect-TS/effect-smol/pull/1496) [`595d2d6`](https://github.com/Effect-TS/effect-smol/commit/595d2d6e7d50419f3532bd39266191532ace38f2) Thanks @IMax153! - Refactor unstable CLI global flags to command-scoped declarations.

  ### Breaking changes
  - Remove `GlobalFlag.add`, `GlobalFlag.remove`, and `GlobalFlag.clear`
  - Add `Command.withGlobalFlags(...)` as the declaration API for command/subcommand scope
  - Change `GlobalFlag.setting` constructor to curried form which carries type-level identifier:
    - before: `GlobalFlag.setting({ flag, ... })`
    - after: `GlobalFlag.setting("id")({ flag })`
  - Change setting context identity to a stable type-level string:
    - `effect/unstable/cli/GlobalFlag/${id}`

  ### Behavior changes
  - Global flags are now scoped by command path (root-to-leaf declarations)
  - Out-of-scope global flags are rejected for the selected subcommand path
  - Help now renders only global flags active for the requested command path
  - Setting defaults are sourced from `Flag` combinators (`optional`, `withDefault`) rather than setting constructor defaults

## 4.0.0-beta.14

### Patch Changes

- [#1471](https://github.com/Effect-TS/effect-smol/pull/1471) [`c414700`](https://github.com/Effect-TS/effect-smol/commit/c414700ef1932e4b67d0102856de417336912350) Thanks @IMax153! - Make CLI global settings directly yieldable and simplify built-in names.

  `GlobalFlag.setting` now takes `{ flag, defaultValue }` and returns a setting that is a `ServiceMap.Reference`, so handlers and `Command.provide*` effects can `yield*` global setting values directly.

  Built-in settings keep internal behavior in `runWith` (for example, `--log-level` still configures `References.MinimumLogLevel`) while also being readable as values.

  Also renamed built-in globals:
  - `GlobalFlag.CompletionsFlag` -> `GlobalFlag.Completions`
  - `GlobalFlag.LogLevelFlag` -> `GlobalFlag.LogLevel`

- [#1490](https://github.com/Effect-TS/effect-smol/pull/1490) [`a30c969`](https://github.com/Effect-TS/effect-smol/commit/a30c9699c0d736cf3952041e45d508b7d58907a9) Thanks @gcanti! - Fix `OpenApi.fromApi` preserving multiple response content types for one status code, closes #1485.

## 4.0.0-beta.13

### Patch Changes

- [#1454](https://github.com/Effect-TS/effect-smol/pull/1454) [`368f4c3`](https://github.com/Effect-TS/effect-smol/commit/368f4c363dd117e6f5a19ad77b161176cfd29fdd) Thanks @lucas-barake! - Expose `NoSuchElementError` in the error type of stream-based `Atom.make` overloads.

- [#1469](https://github.com/Effect-TS/effect-smol/pull/1469) [`db8a579`](https://github.com/Effect-TS/effect-smol/commit/db8a579e93e93ff73b1e60712732e03b597b916b) Thanks @tim-smart! - Update unstable schema variant helpers to use array-based arguments for `FieldOnly`, `FieldExcept`, and `Union`, aligning `VariantSchema` and `Model` with other v4 API shapes.

- [#1457](https://github.com/Effect-TS/effect-smol/pull/1457) [`668b703`](https://github.com/Effect-TS/effect-smol/commit/668b70337e9ddbb0d1ae2282a95c282ce404e562) Thanks @tim-smart! - Run request resolver batch fibers with request services by using `Effect.runForkWith`, so resolver delay effects and `runAll` execution see the request service map.

- [#1461](https://github.com/Effect-TS/effect-smol/pull/1461) [`d40e76b`](https://github.com/Effect-TS/effect-smol/commit/d40e76b973543979e60e04a6baca04a8c65bdfc2) Thanks @mikearnaldi! - Fix `Schedule.fixed` double-executing the effect due to clock jitter.

  The `elapsedSincePrevious > window` check included sleep time from the
  previous step, so any timer imprecision (e.g. 1001ms for a 1000ms sleep)
  triggered an immediate zero-delay re-execution.

- [#1464](https://github.com/Effect-TS/effect-smol/pull/1464) [`6e18cf8`](https://github.com/Effect-TS/effect-smol/commit/6e18cf883e9905ca718a6697b6a2a4bbd42739aa) Thanks @gcanti! - Use the `identifier` annotation as the expected message when available, closes #1458.

- [#1475](https://github.com/Effect-TS/effect-smol/pull/1475) [`86062e8`](https://github.com/Effect-TS/effect-smol/commit/86062e8a0c61bca5412fc40d2cf151d676901f08) Thanks @tim-smart! - Add a CI check job that runs `pnpm ai-docgen` and fails if it produces uncommitted changes.

- [#1448](https://github.com/Effect-TS/effect-smol/pull/1448) [`c27ce75`](https://github.com/Effect-TS/effect-smol/commit/c27ce75d34c74dcfc6dba1bf77f1ce88f410a0de) Thanks @IMax153! - Refactor CLI built-in options to use Effect services with `GlobalFlag`

  Built-in CLI flags (`--help`, `--version`, `--completions`, `--log-level`) are now implemented as Effect services using `ServiceMap.Reference`. This provides:
  - **Visibility**: Built-in flags now appear in help output's "GLOBAL FLAGS" section
  - **Extensibility**: Users can register custom global flags via `GlobalFlag.add`
  - **Override capability**: Built-in flag behavior can be replaced or disabled
  - **Composability**: Flags compose via Effect's service system

  New `GlobalFlag` module exports:
  - `Action<A>` and `Setting<A>` types for different flag behaviors
  - `Help`, `Version`, `Completions`, `LogLevel` references for built-in flags
  - `add`, `remove`, `clear` functions for managing global flags

  Example:

  ```typescript
  const app = Command.make("myapp");
  Command.run(app, { version: "1.0.0" }).pipe(
    GlobalFlag.add(CustomFlag, customFlagValue),
  );
  ```

- [#1468](https://github.com/Effect-TS/effect-smol/pull/1468) [`e2d4fbf`](https://github.com/Effect-TS/effect-smol/commit/e2d4fbfeeda6a5d2a4c5aeb0501d8240c248b9eb) Thanks @lucas-barake! - Fix `Rpc.ExtractProvides` to use middleware service ID instead of constructor type.

- [#1465](https://github.com/Effect-TS/effect-smol/pull/1465) [`114ab42`](https://github.com/Effect-TS/effect-smol/commit/114ab42ad0edc590d29169675a493e0e915aa58f) Thanks @lloydrichards! - tighten Schema on \_meta fields in McpSchema; closes #1463

- [#1470](https://github.com/Effect-TS/effect-smol/pull/1470) [`484caec`](https://github.com/Effect-TS/effect-smol/commit/484caec47cccac8b86db2910742e406dfc7173ab) Thanks @tim-smart! - Add `Command.withAlias` for unstable CLI commands, including subcommand parsing by alias and help output that renders aliases as `name, alias` in subcommand listings.

## 4.0.0-beta.12

### Patch Changes

- [#1439](https://github.com/Effect-TS/effect-smol/pull/1439) [`70a74e8`](https://github.com/Effect-TS/effect-smol/commit/70a74e88a8767c9d4acdb9e5f25aec9a33588d07) Thanks @gcanti! - Add `Config.nested` combinator to scope a config under a named prefix, closes #1437.

- [#1452](https://github.com/Effect-TS/effect-smol/pull/1452) [`b5b6e10`](https://github.com/Effect-TS/effect-smol/commit/b5b6e10621d54bf8c9857fec0d647ced78ecd857) Thanks @tim-smart! - make fiber keepAlive setInterval evaluation lazy

- [#1431](https://github.com/Effect-TS/effect-smol/pull/1431) [`f5ce5a9`](https://github.com/Effect-TS/effect-smol/commit/f5ce5a915359c6ebf254079e1da23cab6cde34fb) Thanks @tim-smart! - Add `Random.nextBoolean` for generating random boolean values.

- [#1450](https://github.com/Effect-TS/effect-smol/pull/1450) [`a29eb70`](https://github.com/Effect-TS/effect-smol/commit/a29eb702ffe3fc58bd28c4d7857298cd65d73668) Thanks @tim-smart! - use cause annotations for detecting client aborts

- [#1445](https://github.com/Effect-TS/effect-smol/pull/1445) [`c7b36e5`](https://github.com/Effect-TS/effect-smol/commit/c7b36e541a23e9a00f64e25b23851e51a37dfce5) Thanks @mattiamanzati! - Fix `Graph.toMermaid` to escape special characters using HTML entity codes per the Mermaid specification.

- [#1443](https://github.com/Effect-TS/effect-smol/pull/1443) [`9381d6d`](https://github.com/Effect-TS/effect-smol/commit/9381d6d4d9d819a81a46e56d0364c76e92a4fbca) Thanks @mikearnaldi! - Fix `HttpClient.retryTransient` autocomplete leaking `Schedule` internals by splitting the `{...} | Schedule` union into separate overloads.

- [#1444](https://github.com/Effect-TS/effect-smol/pull/1444) [`88439f1`](https://github.com/Effect-TS/effect-smol/commit/88439f13ca13549f3e4822c48c4f019c14fc2bcc) Thanks @gcanti! - Schema.encodeKeys: relax input constraint from Struct to schemas with fields so Schema.Class works, closes #1412.

- [#1438](https://github.com/Effect-TS/effect-smol/pull/1438) [`e35307d`](https://github.com/Effect-TS/effect-smol/commit/e35307dbeb8eb26a9923f958b894a8eaaf259bf2) Thanks @mikearnaldi! - Atom.searchParam: decode initial URL values correctly when a schema is provided

- [#1425](https://github.com/Effect-TS/effect-smol/pull/1425) [`c7df4bc`](https://github.com/Effect-TS/effect-smol/commit/c7df4bce34009474c63d62a807abfdafb76971eb) Thanks @candrewlee14! - Fix LanguageModel stripping of resolved approval artifacts across multi-round conversations.

  Previously, `stripResolvedApprovals` only ran when there were pending approvals
  in the current round. Stale artifacts from earlier rounds would leak to the
  provider, causing errors. The stripping now runs unconditionally.

  In streaming mode, pre-resolved tool results are also emitted as stream parts
  so `Chat.streamText` persists them to history, preventing re-resolution on
  subsequent rounds.

- [#1453](https://github.com/Effect-TS/effect-smol/pull/1453) [`accaf3b`](https://github.com/Effect-TS/effect-smol/commit/accaf3be7ac8da36e2334c509c23b8c9e88ea160) Thanks @tim-smart! - allow mcp errors to be encoded correctly

- [#1440](https://github.com/Effect-TS/effect-smol/pull/1440) [`3e1c270`](https://github.com/Effect-TS/effect-smol/commit/3e1c2707bbdf67720af1509642b8ced195790882) Thanks @lloydrichards! - extend McpSchema to work with extensions

- [#1447](https://github.com/Effect-TS/effect-smol/pull/1447) [`6cd81f7`](https://github.com/Effect-TS/effect-smol/commit/6cd81f73baad86f5bbfa455a55d75cde71e9611a) Thanks @tim-smart! - remove all non-regional service usage

- [#1451](https://github.com/Effect-TS/effect-smol/pull/1451) [`f222da3`](https://github.com/Effect-TS/effect-smol/commit/f222da3cdb44554f3324c2c52d0d005ee575053e) Thanks @tim-smart! - Add `Effect.annotateLogsScoped` to apply log annotations for the current scope and automatically restore previous annotations when the scope closes.

- [#1434](https://github.com/Effect-TS/effect-smol/pull/1434) [`61f901d`](https://github.com/Effect-TS/effect-smol/commit/61f901d830005b66e22d1de889fda132aeea97cd) Thanks @tim-smart! - Fix JSON-RPC serialization to return an object for non-batched requests while preserving array responses for true batch requests.

## 4.0.0-beta.11

### Patch Changes

- [#1429](https://github.com/Effect-TS/effect-smol/pull/1429) [`88659ed`](https://github.com/Effect-TS/effect-smol/commit/88659edb26e3623d557dccfe914c2c949672da16) Thanks @tim-smart! - Add grouped subcommand support to `Command.withSubcommands`, including help output sections for named groups while keeping ungrouped commands under `SUBCOMMANDS`.

- [#1426](https://github.com/Effect-TS/effect-smol/pull/1426) [`f2915e8`](https://github.com/Effect-TS/effect-smol/commit/f2915e8e2efe80d50c281e53f297b9701d6dc199) Thanks @tim-smart! - Add `Effect.validate` for validating collections while accumulating all failures, equivalent to the v3 `Effect.validateAll` behavior.

- [#1430](https://github.com/Effect-TS/effect-smol/pull/1430) [`eb71ace`](https://github.com/Effect-TS/effect-smol/commit/eb71acebbe0f228e4920278013beee3b67d62310) Thanks @tim-smart! - Add `Command.withExamples` to attach concrete usage examples to CLI commands, expose them through `HelpDoc.examples`, and render them in the default help formatter.

- [#1415](https://github.com/Effect-TS/effect-smol/pull/1415) [`2a16999`](https://github.com/Effect-TS/effect-smol/commit/2a169996c7513d377ac47adbfd68e1490457135c) Thanks @mikearnaldi! - HashMap: compare HAMT bit positions as unsigned to preserve entry lookup when bit 31 is set

- [#1417](https://github.com/Effect-TS/effect-smol/pull/1417) [`d42dd52`](https://github.com/Effect-TS/effect-smol/commit/d42dd52f11203f8e749fb5d3ecf7153e4a5a6814) Thanks @mikearnaldi! - unstable/http Headers: hide inspectable prototype methods from for..in iteration to avoid invalid header names in runtime fetch polyfills

- [#1418](https://github.com/Effect-TS/effect-smol/pull/1418) [`339adaf`](https://github.com/Effect-TS/effect-smol/commit/339adaf850a62a892adebcb208c2d9dddf3b97b3) Thanks @mikearnaldi! - runtime: guard keepAlive setInterval / clearInterval so Effect.runPromise works in runtimes that block timer APIs

- [#1416](https://github.com/Effect-TS/effect-smol/pull/1416) [`de19645`](https://github.com/Effect-TS/effect-smol/commit/de1964526d01102dd1cb99c8cfdd3e8df1f49ef1) Thanks @mikearnaldi! - Queue.collect: stop duplicating drained messages by appending each batch once

- [#1413](https://github.com/Effect-TS/effect-smol/pull/1413) [`9b1dc3b`](https://github.com/Effect-TS/effect-smol/commit/9b1dc3bcf2a1b68d0a67e3465db5ad01a1a56997) Thanks @gcanti! - Fix `Schema.TupleWithRest` incorrectly accepting inputs with missing post-rest elements, closes #1410.

- [#1409](https://github.com/Effect-TS/effect-smol/pull/1409) [`e4cb2f5`](https://github.com/Effect-TS/effect-smol/commit/e4cb2f55b30f4771ec1bf613ced36d6d96464dd5) Thanks @tim-smart! - add ErrorReporter module

- [#1427](https://github.com/Effect-TS/effect-smol/pull/1427) [`8bced95`](https://github.com/Effect-TS/effect-smol/commit/8bced954ecb35d4489197a57b0efe927e7d75f49) Thanks @tim-smart! - Add `Command.annotate` and `Command.annotateMerge` to unstable CLI commands, and include command annotations in `HelpDoc` so custom help formatters can access command metadata.

- [#1401](https://github.com/Effect-TS/effect-smol/pull/1401) [`9431420`](https://github.com/Effect-TS/effect-smol/commit/94314207c8019918200fbcb97aec992219f801f0) Thanks @tim-smart! - Add `WorkflowEngine.layer`, an in-memory layer for the unstable workflow engine.

- [#1428](https://github.com/Effect-TS/effect-smol/pull/1428) [`948dca2`](https://github.com/Effect-TS/effect-smol/commit/948dca22e4f672ba7a6db57f9899272bec7c08b8) Thanks @tim-smart! - Add `Command.withShortDescription` and use short descriptions for CLI subcommand listings, with fallback to the full command description.

- [#1405](https://github.com/Effect-TS/effect-smol/pull/1405) [`d18e327`](https://github.com/Effect-TS/effect-smol/commit/d18e32765a2665e31ffb31e746bf983fcfac34c5) Thanks @candrewlee14! - Strip resolved tool approval artifacts from prompt before sending to provider, preventing errors when providers reject pre-resolved approval requests.

- [#1424](https://github.com/Effect-TS/effect-smol/pull/1424) [`ab512f7`](https://github.com/Effect-TS/effect-smol/commit/ab512f7be1c0e6b359da921e22cd4944e4c57d3e) Thanks @tim-smart! - expose more atom Node properties

## 4.0.0-beta.10

### Patch Changes

- [#1396](https://github.com/Effect-TS/effect-smol/pull/1396) [`371acab`](https://github.com/Effect-TS/effect-smol/commit/371acabb58d56f3a7a5e3e33d3d5fdc9f5573c74) Thanks @gcanti! - Add `unstable/encoding` subpath export.

- [#1392](https://github.com/Effect-TS/effect-smol/pull/1392) [`856d774`](https://github.com/Effect-TS/effect-smol/commit/856d7741f1e296dd5048c6ff2b44b95d023e6ae4) Thanks @tim-smart! - Fix a race in `Semaphore.take` where interruption could leak permits after a waiter was resumed.

- [#1388](https://github.com/Effect-TS/effect-smol/pull/1388) [`b9e9202`](https://github.com/Effect-TS/effect-smol/commit/b9e92023c38caa322975d77cfe83e2d34ac9305a) Thanks @tim-smart! - Export `Effect` do notation APIs (`Do`, `bindTo`, `bind`, and `let`) from `effect/Effect` and add runtime and type-level coverage.

- [#1387](https://github.com/Effect-TS/effect-smol/pull/1387) [`1d1a974`](https://github.com/Effect-TS/effect-smol/commit/1d1a974bd280c81bff5d4505491cda03ba7a3f36) Thanks @tim-smart! - short circuit when Fiber.joinAll is called with an empty iterable

- [#1386](https://github.com/Effect-TS/effect-smol/pull/1386) [`6bfe2a6`](https://github.com/Effect-TS/effect-smol/commit/6bfe2a659bc6335db75709931f405da45301cba2) Thanks @tim-smart! - simplify http logger disabling

- [#1381](https://github.com/Effect-TS/effect-smol/pull/1381) [`b12c811`](https://github.com/Effect-TS/effect-smol/commit/b12c81157be287b1649c210616a244b50ec094d2) Thanks @tim-smart! - Fix `UrlParams.Input` usage to accept interface-typed records in HTTP client and server helpers while keeping coercion constraints for url parameter values.

- [#1383](https://github.com/Effect-TS/effect-smol/pull/1383) [`d17d98a`](https://github.com/Effect-TS/effect-smol/commit/d17d98ad78e2b44d95ef434adab79ac3c35e75ab) Thanks @tim-smart! - Rename `HttpClient.retryTransient` option `mode` to `retryOn` and rename `"both"` to `"errors-and-responses"`.

- [#1399](https://github.com/Effect-TS/effect-smol/pull/1399) [`68c3c7c`](https://github.com/Effect-TS/effect-smol/commit/68c3c7cb1e06ed94fa5c4c123a234b4ccbfdecd8) Thanks @tim-smart! - Add `Random.shuffle` to shuffle iterables with seeded randomness support.

## 4.0.0-beta.9

### Patch Changes

- [#1376](https://github.com/Effect-TS/effect-smol/pull/1376) [`3386557`](https://github.com/Effect-TS/effect-smol/commit/338655731564a7be9f8859dedbf4d5bcac6eb350) Thanks @gcanti! - HttpApiEndpoint: relax `params`, `query`, and `headers` constraints to accept a full schema in addition to a record of fields.

- [#1379](https://github.com/Effect-TS/effect-smol/pull/1379) [`b6666e3`](https://github.com/Effect-TS/effect-smol/commit/b6666e3cf6bd44ba1a8704e65c256c30359cb422) Thanks @tim-smart! - Fix `AtomHttpApi.query` to forward v4 `params` / `query` request fields to `HttpApiClient` at runtime.
  Also align `AtomHttpApi` endpoint type inference with v4 `HttpApiEndpoint` params/query naming and add a regression test.

## 4.0.0-beta.8

### Patch Changes

- [#1371](https://github.com/Effect-TS/effect-smol/pull/1371) [`246e672`](https://github.com/Effect-TS/effect-smol/commit/246e672dbbd7848d60e0c78fd66671b2f10b3752) Thanks @IMax153! - Fix `ChildProcess` options type and implement `PgMigrator`

- [#1372](https://github.com/Effect-TS/effect-smol/pull/1372) [`807dec0`](https://github.com/Effect-TS/effect-smol/commit/807dec03801b4c58a6d00c237b6d98d6386911df) Thanks @pawelblaszczyk5! - Remove superfluous error from SqlSchema.findAll signature

## 4.0.0-beta.7

### Patch Changes

- [#1366](https://github.com/Effect-TS/effect-smol/pull/1366) [`a2bda6d`](https://github.com/Effect-TS/effect-smol/commit/a2bda6d4ef6de9d9b0c53ae2df5434f778d6161a) Thanks @tim-smart! - rename SqlSchema.findOne\* apis

- [#1360](https://github.com/Effect-TS/effect-smol/pull/1360) [`1f95a2b`](https://github.com/Effect-TS/effect-smol/commit/1f95a2b5aa9524bb38f4437f4691a664bf463ca1) Thanks @tim-smart! - Add `Schedule.jittered` to randomize schedule delays between 80% and 120% of the original delay.

- [#1364](https://github.com/Effect-TS/effect-smol/pull/1364) [`a8d5e79`](https://github.com/Effect-TS/effect-smol/commit/a8d5e792fec201a83af0eb92fc79928d055125fd) Thanks @gcanti! - Schema: avoid eager resolution for type-level helpers, closes #1332

- [#1369](https://github.com/Effect-TS/effect-smol/pull/1369) [`a5386ba`](https://github.com/Effect-TS/effect-smol/commit/a5386ba67005dff697d45a45398f398773f58dcf) Thanks @tim-smart! - align HttpClientRequest constructors with http method names

- [#1369](https://github.com/Effect-TS/effect-smol/pull/1369) [`a5386ba`](https://github.com/Effect-TS/effect-smol/commit/a5386ba67005dff697d45a45398f398773f58dcf) Thanks @tim-smart! - remove body restriction for HttpClientRequest's

- [#1358](https://github.com/Effect-TS/effect-smol/pull/1358) [`06d8a03`](https://github.com/Effect-TS/effect-smol/commit/06d8a0391631e6130e3ab25227e59817852e227f) Thanks @tim-smart! - Add `LogLevel.isEnabled` for checking a log level against `References.MinimumLogLevel`.

- [#1363](https://github.com/Effect-TS/effect-smol/pull/1363) [`8caac76`](https://github.com/Effect-TS/effect-smol/commit/8caac76a35821edfe03c75dab5eb056e8fc05430) Thanks @tim-smart! - rename DurationInput to Duration.Input

- [#1363](https://github.com/Effect-TS/effect-smol/pull/1363) [`8caac76`](https://github.com/Effect-TS/effect-smol/commit/8caac76a35821edfe03c75dab5eb056e8fc05430) Thanks @tim-smart! - DateTime.distance now returns a Duration

- [#1367](https://github.com/Effect-TS/effect-smol/pull/1367) [`f9e883e`](https://github.com/Effect-TS/effect-smol/commit/f9e883e266fbda870336ee62f46b7ac85ba3de6e) Thanks @tim-smart! - refactor SqlSchema apis

- [#1363](https://github.com/Effect-TS/effect-smol/pull/1363) [`8caac76`](https://github.com/Effect-TS/effect-smol/commit/8caac76a35821edfe03c75dab5eb056e8fc05430) Thanks @tim-smart! - remove rpc client nesting to improve type performance

## 4.0.0-beta.6

### Patch Changes

- [#1338](https://github.com/Effect-TS/effect-smol/pull/1338) [`3247da2`](https://github.com/Effect-TS/effect-smol/commit/3247da28331f345f68be5dbd2974a7e03d300fe1) Thanks @Leka74! - Add `showOperationId` to `HttpApiScalar.ScalarConfig`.

- [#1326](https://github.com/Effect-TS/effect-smol/pull/1326) [`f205705`](https://github.com/Effect-TS/effect-smol/commit/f2057050dbd034b8c186be2d40c3d03ee63a5a3b) Thanks @gcanti! - Schema: add `BigDecimal` schema with comparison checks (`isGreaterThanBigDecimal`, `isGreaterThanOrEqualToBigDecimal`, `isLessThanBigDecimal`, `isLessThanOrEqualToBigDecimal`, `isBetweenBigDecimal`).

- [#1328](https://github.com/Effect-TS/effect-smol/pull/1328) [`f35022c`](https://github.com/Effect-TS/effect-smol/commit/f35022c212e4111527e1bb43f360a67b2b49fa85) Thanks @gcanti! - Schema: add `DateTimeZoned`, `TimeZoneOffset`, `TimeZoneNamed`, and `TimeZone` schemas.

- [#1325](https://github.com/Effect-TS/effect-smol/pull/1325) [`8622721`](https://github.com/Effect-TS/effect-smol/commit/86227217b02d43680a3c6f3c21731b1d852c91f5) Thanks @KhraksMamtsov! - Make `Data.Class`, `Data.TaggedClass`, and `Cause.YieldableError` pipeable.

- [#1323](https://github.com/Effect-TS/effect-smol/pull/1323) [`fc660ab`](https://github.com/Effect-TS/effect-smol/commit/fc660ab8b5ebae38b8d6b96cbf2f9b880cc09253) Thanks @KhraksMamtsov! - Port `Pipeable.Class` from v3.

  ```ts
  class MyClass extends Pipeable.Class() {
    constructor(public a: number) {
      super();
    }
    methodA() {
      return this.a;
    }
  }
  console.log(new MyClass(2).pipe((x) => x.methodA())); // 2
  ```

  ```ts
  class A {
    constructor(public a: number) {}
    methodA() {
      return this.a;
    }
  }
  class B extends Pipeable.Class(A) {
    constructor(private b: string) {
      super(b.length);
    }
    methodB() {
      return [this.b, this.methodA()];
    }
  }
  console.log(new B("pipe").pipe((x) => x.methodB())); // ['pipe', 4]
  ```

- [#1337](https://github.com/Effect-TS/effect-smol/pull/1337) [`f37dc33`](https://github.com/Effect-TS/effect-smol/commit/f37dc335f64622fa9ce8d6d1d5dd8fc3f260257b) Thanks @IMax153! - Encoding: consolidate `effect/encoding` sub-modules (Base64, Base64Url, Hex, EncodingError) into a top-level `Encoding` module. Functions are now prefixed: `encodeBase64`, `decodeBase64`, `encodeHex`, `decodeHex`, etc. The `effect/encoding` sub-path export is removed.

- [#1351](https://github.com/Effect-TS/effect-smol/pull/1351) [`3662f32`](https://github.com/Effect-TS/effect-smol/commit/3662f328fcfa3b2fa01ffa79da40e12e93fcede8) Thanks @tim-smart! - add `Schema.HashSet` for decoding and encoding `HashSet` values.

- [#1336](https://github.com/Effect-TS/effect-smol/pull/1336) [`a7d436f`](https://github.com/Effect-TS/effect-smol/commit/a7d436f438dcd7f49b9485e4e95a4511f31fad7d) Thanks @mikearnaldi! - Extract `Semaphore` and `Latch` into their own modules.

  `Semaphore.make` / `Semaphore.makeUnsafe` replace `Effect.makeSemaphore` / `Effect.makeSemaphoreUnsafe`.
  `Latch.make` / `Latch.makeUnsafe` replace `Effect.makeLatch` / `Effect.makeLatchUnsafe`.

  Merge `PartitionedSemaphore` into `Semaphore` as `Semaphore.Partitioned`, `Semaphore.makePartitioned`, `Semaphore.makePartitionedUnsafe`.

- [#1345](https://github.com/Effect-TS/effect-smol/pull/1345) [`6856a41`](https://github.com/Effect-TS/effect-smol/commit/6856a415d7eddd9d73d60919e976f1d071421be4) Thanks @tim-smart! - allocate less effects when reading a file

- [#1350](https://github.com/Effect-TS/effect-smol/pull/1350) [`8c417d0`](https://github.com/Effect-TS/effect-smol/commit/8c417d03475e5e12d00dca0c4781d0af7e66b86c) Thanks @tim-smart! - Add "Previously Known As" JSDoc migration notes for the `Semaphore` and `Latch` APIs extracted from `Effect`.

- [#1355](https://github.com/Effect-TS/effect-smol/pull/1355) [`5419570`](https://github.com/Effect-TS/effect-smol/commit/5419570ba47ce882a3a10882707b46f66e464906) Thanks @tim-smart! - ensure non-middleware http errors are correctly handled

- [#1352](https://github.com/Effect-TS/effect-smol/pull/1352) [`449c5ed`](https://github.com/Effect-TS/effect-smol/commit/449c5ed5318e8a874e730420bcf52918fa2ec80f) Thanks @tim-smart! - Add `Schema.HashMap` for decoding and encoding `HashMap` values.

- [#1347](https://github.com/Effect-TS/effect-smol/pull/1347) [`4b5ec12`](https://github.com/Effect-TS/effect-smol/commit/4b5ec12f87f95f2a3cd8fe4d5b26c6eb0529381a) Thanks @tim-smart! - use .toJSON for default .toString implementations

- [#1329](https://github.com/Effect-TS/effect-smol/pull/1329) [`df87937`](https://github.com/Effect-TS/effect-smol/commit/df879375fc3b169c43f9c434b3775e12b80dffe4) Thanks @gcanti! - Schema: extract shared `dateTimeUtcFromString` transformation for `DateTimeUtc` and `DateTimeUtcFromString`.

- [#1318](https://github.com/Effect-TS/effect-smol/pull/1318) [`5dbfca8`](https://github.com/Effect-TS/effect-smol/commit/5dbfca8d1dbb6d18d1605d4f8562e99c86e2ff11) Thanks @gcanti! - Schema: rename `$` suffix to `$` prefix for type-level identifiers that conflict with built-in names (`Array$` → `$Array`, `Record$` → `$Record`, `ReadonlyMap$` → `$ReadonlyMap`, `ReadonlySet$` → `$ReadonlySet`).

- [#1356](https://github.com/Effect-TS/effect-smol/pull/1356) [`e629497`](https://github.com/Effect-TS/effect-smol/commit/e6294973d55597ab6b6deca6babbe1e946b2c91d) Thanks @tim-smart! - allow passing void for request constructors

- [#1348](https://github.com/Effect-TS/effect-smol/pull/1348) [`981c991`](https://github.com/Effect-TS/effect-smol/commit/981c991cd78db34def815d5754379d737157f005) Thanks @tim-smart! - Fix `Schedule.andThenResult` to initialize the right schedule only after the left schedule completes.
  This removes the extra immediate transition tick and correctly completes when the right schedule is finite.

- [#1320](https://github.com/Effect-TS/effect-smol/pull/1320) [`1ca2ed6`](https://github.com/Effect-TS/effect-smol/commit/1ca2ed67301a5dc40ae0ed94346b99f26fd22bbe) Thanks @gcanti! - Struct: add `Struct.Record` constructor for creating records with the given keys and value.

- [#1342](https://github.com/Effect-TS/effect-smol/pull/1342) [`45722bd`](https://github.com/Effect-TS/effect-smol/commit/45722bde974458311f11ad237711363a10ec6894) Thanks @cevr! - `Schema.TaggedErrorClass`, `Schema.Class`, and `Schema.ErrorClass` constructors now allow omitting the props argument when all fields have constructor defaults (e.g. `new MyError()` instead of `new MyError({})`).

- [#1322](https://github.com/Effect-TS/effect-smol/pull/1322) [`eb2a85e`](https://github.com/Effect-TS/effect-smol/commit/eb2a85ed4dc162b2535d304799333a5a20477fd0) Thanks @tim-smart! - Add a `requireServicesAt` option to `PersistedCache.make` so lookup-service requirements can be configured like `Cache`.

## 4.0.0-beta.5

### Patch Changes

- [#1317](https://github.com/Effect-TS/effect-smol/pull/1317) [`f6e133e`](https://github.com/Effect-TS/effect-smol/commit/f6e133e9a16b32317bd09ff08c12b97a0ae44600) Thanks @tim-smart! - support tag unions in Effect.catchTag/Reason

- [#1314](https://github.com/Effect-TS/effect-smol/pull/1314) [`e3893cc`](https://github.com/Effect-TS/effect-smol/commit/e3893ccf2632338c7d8e745f639dcd825a9d42f8) Thanks @zeyuri! - Fix `Atom.serializable` encode/decode for wire transfer.

  Use `Schema.toCodecJson` instead of `Schema.encodeSync`/`Schema.decodeSync` directly, so that encoded values are plain JSON objects that survive serialization roundtrips (JSON, seroval, etc.). Previously, `AsyncResult.Schema` encode produced instances with custom prototypes that were lost after wire transfer, causing decode to fail with "Expected AsyncResult" errors during SSR hydration.

- [#1315](https://github.com/Effect-TS/effect-smol/pull/1315) [`a88e206`](https://github.com/Effect-TS/effect-smol/commit/a88e206e44dc66ca5a2b45bedc797877c5dbb083) Thanks @tim-smart! - add Filter.reason api

- [#1314](https://github.com/Effect-TS/effect-smol/pull/1314) [`e3893cc`](https://github.com/Effect-TS/effect-smol/commit/e3893ccf2632338c7d8e745f639dcd825a9d42f8) Thanks @zeyuri! - Port ReactHydration to effect-smol.

  Add `Hydration` module to `effect/unstable/reactivity` with `dehydrate`, `hydrate`, and `toValues` for SSR state serialization. Add `HydrationBoundary` React component to `@effect/atom-react` with two-phase hydration (new atoms in render, existing atoms after commit).

## 4.0.0-beta.4

### Patch Changes

- [#1308](https://github.com/Effect-TS/effect-smol/pull/1308) [`c5a18ef`](https://github.com/Effect-TS/effect-smol/commit/c5a18ef44171e3880bf983faee74529908974b32) Thanks @tim-smart! - improve Schema.TaggedUnion .match auto completion

- [#1310](https://github.com/Effect-TS/effect-smol/pull/1310) [`bc6b885`](https://github.com/Effect-TS/effect-smol/commit/bc6b885b94d887a200657c0775dfa874dc15bc0c) Thanks @tim-smart! - Add `Schedule.duration`, a one-shot schedule that waits for the provided duration and then completes.

## 4.0.0-beta.3

### Patch Changes

- [#1303](https://github.com/Effect-TS/effect-smol/pull/1303) [`3a0cf36`](https://github.com/Effect-TS/effect-smol/commit/3a0cf36eff106ba48d74e133c1598cd40613e530) Thanks @tim-smart! - add Result.failVoid

- [#1307](https://github.com/Effect-TS/effect-smol/pull/1307) [`c4da328`](https://github.com/Effect-TS/effect-smol/commit/c4da328d32fad1d61e0e538f5d371edf61521d7e) Thanks @tim-smart! - Add `HttpClientRequest.bodyFormDataRecord` and `HttpBody.makeFormDataRecord` helpers for creating multipart form bodies from plain records.

## 4.0.0-beta.2

### Patch Changes

- [#1302](https://github.com/Effect-TS/effect-smol/pull/1302) [`a22ce73`](https://github.com/Effect-TS/effect-smol/commit/a22ce73b2bd9305b7ba665694d2255c0e6d5a8d0) Thanks @tim-smart! - allow undefined for VariantSchema.Overridable input

- [#1299](https://github.com/Effect-TS/effect-smol/pull/1299) [`ebdabf7`](https://github.com/Effect-TS/effect-smol/commit/ebdabf79ff4e62c8384aa8cf9a8d2787d536ee78) Thanks @tim-smart! - Port `SqlSchema.findOne` from effect v3 to return `Option` on empty results and add `SqlSchema.single` for the fail-on-empty behavior.

- [#1298](https://github.com/Effect-TS/effect-smol/pull/1298) [`8f663bb`](https://github.com/Effect-TS/effect-smol/commit/8f663bb121021bf12bd264e8ae385187cb7a5dae) Thanks @tim-smart! - Add `Effect.catchNoSuchElement`, a renamed port of v3 `Effect.optionFromOptional` that converts `NoSuchElementError` failures into `Option.none`.

## 4.0.0-beta.1

### Patch Changes

- [#1293](https://github.com/Effect-TS/effect-smol/pull/1293) [`0fecf70`](https://github.com/Effect-TS/effect-smol/commit/0fecf70048057623eed7c584a06671773a2b1743) Thanks @mikearnaldi! - Add `Effect.filter` support for synchronous `Filter.Filter` overloads and correctly handle non-effect `Result` return values at runtime.

- [#1294](https://github.com/Effect-TS/effect-smol/pull/1294) [`709569e`](https://github.com/Effect-TS/effect-smol/commit/709569ed76bead9ebb0670599e4d890a07ca5a43) Thanks @tim-smart! - Fix `Prompt.text` and related text prompts to initialize from `default` values so users can edit the default input directly.

## 4.0.0-beta.0

### Major Changes

- [#1183](https://github.com/Effect-TS/effect-smol/pull/1183) [`be642ab`](https://github.com/Effect-TS/effect-smol/commit/be642ab1b3b4cd49e53c9732d7aba1b367fddd66) Thanks @tim-smart! - v4 beta
