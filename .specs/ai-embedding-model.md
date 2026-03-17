# AI EmbeddingModel Module

## Summary

Add an `EmbeddingModel` module to `effect/unstable/ai` that provides a
provider-agnostic service for generating vector embeddings from text, with
built-in batching via `RequestResolver` and telemetry integration.

## Background

The v3 `@effect/ai` package included an `EmbeddingModel` module that used
Effect's `Request`/`RequestResolver` system for batching and optional caching.
It also had a `makeDataLoader` variant using `@effect/experimental`. In v4, the
AI modules have been consolidated into the core `effect` package under
`effect/unstable/ai`, following new patterns:

- Services use `ServiceMap.Service` (not `Context.Tag`)
- `Model.make` provides unified provider wrapping
- `RequestResolver` natively supports data loader patterns via `setDelay`/`batchN`
- Caching is handled via `RequestResolver.withCache`/`asCache`
- Telemetry already includes `"embeddings"` as a `WellKnownOperationName`

## Goals

- Define an `EmbeddingModel` service following v4 `ServiceMap.Service` patterns
- Provide `embed` (single string) and `embedMany` (batch) operations
- Return response classes with metadata (usage/token info), consistent with
  `LanguageModel.GenerateTextResponse`
- Use `RequestResolver` for batching; let users compose caching/delay via
  resolver combinators
- Integrate with `Model.make` for provider wrapping
- Add OpenTelemetry spans with `"embeddings"` operation name
- Keep the module focused and simple compared to `LanguageModel`

## Non-goals

- Streaming embeddings (not a standard pattern)
- Token array inputs (only string inputs)
- Built-in caching in the constructor (composable via `RequestResolver` APIs)
- Provider implementations (those belong in `@effect/ai-openai` etc.)
- Image or multimodal embeddings

## Requirements

### Service Definition

The `EmbeddingModel` service class must use the `ServiceMap.Service` pattern:

```ts
export class EmbeddingModel extends ServiceMap.Service<EmbeddingModel, Service>()(
  "effect/unstable/ai/EmbeddingModel"
) {}
```

### Service Interface

```ts
export interface Service {
  readonly resolver: RequestResolver.RequestResolver<EmbeddingRequest, AiError.AiError>

  readonly embed: (
    input: string
  ) => Effect.Effect<EmbedResponse, AiError.AiError>

  readonly embedMany: (
    input: ReadonlyArray<string>
  ) => Effect.Effect<EmbedManyResponse, AiError.AiError>
}
```

The `resolver` property exposes the pre-constructed `RequestResolver` so users
can compose caching, delay, and batch sizing via resolver combinators
(`RequestResolver.withCache`, `setDelay`, `batchN`, etc.) without
reimplementing the batching logic.

### Response Types

Schema classes using `Schema.Class`, following the pattern used by
`Response.Usage` in `Response.ts`. This enables serialization for RPC,
persistence, and devtools.

**`EmbeddingUsage`** -- token usage for embedding operations:

```ts
export class EmbeddingUsage extends Schema.Class<EmbeddingUsage>(
  "effect/ai/EmbeddingModel/EmbeddingUsage"
)({
  inputTokens: Schema.UndefinedOr(Schema.Number)
}) {}
```

Named `inputTokens` to align with OpenTelemetry `gen_ai.usage.input_tokens`
and the `Response.Usage` pattern. Embedding APIs only report input tokens
(no output tokens like language models). Uses `Schema.UndefinedOr` since the
field is always present but may be `undefined` when the provider doesn't
report token counts.

**`EmbedResponse`** -- response for a single embedding:

```ts
export class EmbedResponse extends Schema.Class<EmbedResponse>(
  "effect/ai/EmbeddingModel/EmbedResponse"
)({
  vector: Schema.Array(Schema.Number)
}) {}
```

Individual `EmbedResponse` from `embed` does not include usage. When requests
are batched by the resolver, the provider returns one aggregated usage for the
entire batch. Attributing per-request usage is not possible since the provider
reports a single total. Usage is only available at the batch level via
`EmbedManyResponse`.

**`EmbedManyResponse`** -- response for batch embeddings:

```ts
export class EmbedManyResponse extends Schema.Class<EmbedManyResponse>(
  "effect/ai/EmbeddingModel/EmbedManyResponse"
)({
  embeddings: Schema.Array(EmbedResponse),
  usage: EmbeddingUsage
}) {}
```

### Provider Interface

Providers implement `embedMany` only. The `make` constructor wraps it:

```ts
export interface ProviderOptions {
  readonly inputs: ReadonlyArray<string>
}

export interface ProviderResult {
  /** Position in the original `inputs` array this result corresponds to. */
  readonly index: number
  readonly vector: Array<number>
}

export interface ProviderResponse {
  readonly results: Array<ProviderResult>
  readonly usage: {
    readonly inputTokens: number | undefined
  }
}
```

`ProviderOptions` does not include a `span` field. The resolver batches
requests from multiple concurrent `embed` callers, so there is no single
natural parent span. Telemetry spans are managed by the service methods
(`embed`/`embedMany`), not the provider callback. Provider implementations
should add their own spans and `Telemetry.addGenAIAnnotations` internally.

### Constructor

The `make` constructor takes a provider's `embedMany` function and creates
the service:

```ts
export const make: (params: {
  readonly embedMany: (
    options: ProviderOptions
  ) => Effect.Effect<ProviderResponse, AiError.AiError>
}) => Effect.Effect<Service>
```

**Internal behavior using v4 `RequestResolver.make` pattern:**

1. Create a `RequestResolver` using `RequestResolver.make`. The resolver
   callback receives `NonEmptyArray<Request.Entry<EmbeddingRequest>>` and a
   batch key:

   ```ts
   const resolver = RequestResolver.make(
     (entries: NonEmptyArray<Request.Entry<EmbeddingRequest>>) => {
       // 1. Collect inputs from entries
       const inputs = entries.map((e) => e.request.input)
       // 2. Call provider's embedMany
        // 3. On success: distribute results to entries via entry.completeUnsafe
        //    matching ProviderResult.index to the entry position
        // 4. On error: complete all entries with entry.completeUnsafe
     }
   )
   ```

2. For each entry in the batch, extract `entry.request.input` to build the
   input array.

3. Call the provider's `embedMany({ inputs })`.

 4. On success, iterate `response.results` and complete each entry:
    ```ts
    entries[result.index].completeUnsafe(Exit.succeed(new EmbedResponse({
      vector: result.vector
    })))
    ```

 5. On error, complete all entries with the error:
    ```ts
    entries.forEach((entry) => entry.completeUnsafe(Exit.fail(error)))
    ```

 6. `embed(input)` creates a single `EmbeddingRequest` and resolves it via
    `Effect.request(new EmbeddingRequest({ input }), resolver)`, wrapped in
    `Effect.withSpan("EmbeddingModel.embed")`.

 7. `embedMany(inputs)` calls the provider's `embedMany` directly (bypassing
    the resolver), maps the `ProviderResponse` into an `EmbedManyResponse`,
    and wraps in `Effect.withSpan("EmbeddingModel.embedMany")`.

 8. **Empty array handling:** `embedMany([])` returns immediately with an empty
    `EmbedManyResponse` (empty embeddings array, usage with `undefined` tokens).
    The provider is never called.

**Provider integration with `Layer`:**

Providers wrap `make` in a `Layer` for dependency injection:

```ts
// In a provider package (e.g., @effect/ai-openai)
const layer = Layer.effect(
  EmbeddingModel.EmbeddingModel,
  EmbeddingModel.make({
    embedMany: (options) => /* call provider API */
  })
)

// With Model.make for unified provider wrapping
const model = Model.make("openai", "text-embedding-3-small", layer)
```

### Request Type

Public tagged request class for the resolver (exported so users can work
with the `resolver` property directly):

```ts
export class EmbeddingRequest extends Request.TaggedClass("EmbeddingRequest")<
  { readonly input: string },
  EmbedResponse,
  AiError.AiError
> {}
```

### Telemetry

Span hierarchy:

- `embed` creates span `"EmbeddingModel.embed"`. The resolver runs within
  this span context. When multiple `embed` calls are batched, each has its own
  span, and the resolver may execute under any one of them.
- `embedMany` creates a single outer span `"EmbeddingModel.embedMany"`. The
  individual `embed` requests dispatched internally via `Effect.forEach` do
  NOT create individual sub-spans -- only the outer span exists.
- Provider implementations should add their own spans (e.g.,
  `"OpenAiEmbeddingModel.embedMany"`) and use
  `Telemetry.addGenAIAnnotations` with `operation.name: "embeddings"`.

### Module JSDoc

Follow the established pattern from `Tokenizer.ts` and `LanguageModel.ts`:
- Module-level JSDoc with `@example` blocks showing basic usage
- `@since 4.0.0`
- Category annotations: `services`, `models`, `constructors`

### Barrel Export

The module must be exported from `packages/effect/src/unstable/ai/index.ts`.
Since barrel files are auto-generated, run `pnpm codegen` after creating the
module.

## Testing

Tests go in `packages/effect/test/unstable/ai/EmbeddingModel.test.ts`.

Use `@effect/vitest` with `it.effect` pattern. Use `assert` (not `expect`).

### Test Cases

1. **`embed` returns a vector** -- Create a mock provider that returns a
   fixed vector. Call `embed("hello")`. Assert the vector matches.

2. **`embedMany` returns multiple vectors with usage** -- Create a mock
   provider that returns vectors and usage. Call
   `embedMany(["hello", "world"])`. Assert both vectors are returned with
   correct ordering and usage is populated.

3. **`embed` batches multiple concurrent calls** -- Create a mock provider
   that tracks call count. Fire multiple `embed` calls concurrently with
   `Effect.all([embed("a"), embed("b"), embed("c")])`. Assert the provider's
   `embedMany` was called once (all requests batched together).

4. **Error propagation** -- Create a mock provider that fails with an
   `AiError`. Call `embed`. Assert the error propagates correctly with the
   right tag and reason.

5. **`embedMany` with empty array** -- Call `embedMany([])`. Assert it returns
   an `EmbedManyResponse` with empty embeddings and undefined usage.

## Validation

After implementation, run in order:

1. `pnpm codegen` (regenerate barrel exports -- must run before check/test)
2. `pnpm lint-fix`
3. `pnpm test packages/effect/test/unstable/ai/EmbeddingModel.test.ts`
4. `pnpm check:tsgo` (if failing, `pnpm clean` then re-run)
5. `pnpm docgen`

## Acceptance Criteria

- `EmbeddingModel` service defined with `ServiceMap.Service` pattern
- `embed` and `embedMany` methods on the service interface
- `EmbedResponse`, `EmbedManyResponse`, and `EmbeddingUsage` response classes
- `make` constructor wraps provider's `embedMany` with `RequestResolver`
- Automatic batching when multiple `embed` calls are concurrent
- OpenTelemetry spans on `embed` and `embedMany`
- All errors typed as `AiError.AiError`
- Module exported from `effect/unstable/ai` barrel
- Tests pass covering core functionality, batching, and error propagation
- All validation commands pass (`codegen`, `lint-fix`, `test`, `check:tsgo`, `docgen`)

## Implementation Plan

### Task 1: Create EmbeddingModel module with service, types, constructor, and tests

Create `packages/effect/src/unstable/ai/EmbeddingModel.ts` containing:

- `EmbeddingModel` service class (`ServiceMap.Service`)
- `Service` interface with `embed` and `embedMany`
- `EmbedResponse`, `EmbedManyResponse`, `EmbeddingUsage` plain classes
- `ProviderOptions`, `ProviderResult`, `ProviderResponse` interfaces
- Internal `EmbeddingRequest` tagged request class
- `make` constructor that:
  - Creates a `RequestResolver` using `RequestResolver.make` with the v4
    entry-based API
  - Implements `embed` using `Effect.request` + the resolver
  - Implements `embedMany` using `Effect.forEach` with `{ batching: true }`
  - Wraps both in `Effect.withSpan`

Then run `pnpm codegen` to add the barrel export to
`packages/effect/src/unstable/ai/index.ts`.

Create `packages/effect/test/unstable/ai/EmbeddingModel.test.ts` with tests
for: single embed, embedMany with usage, batching behavior, error propagation,
and empty input.

**Validation:** `pnpm codegen && pnpm lint-fix && pnpm test packages/effect/test/unstable/ai/EmbeddingModel.test.ts && pnpm check:tsgo && pnpm docgen`
