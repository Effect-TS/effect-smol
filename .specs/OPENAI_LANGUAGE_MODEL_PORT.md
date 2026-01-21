# OpenAiLanguageModel Port to Effect v4

**Status: DRAFT**

## Overview

Port the Effect v3 `OpenAiLanguageModel` implementation from `.repos/effect/packages/ai/openai/src/OpenAiLanguageModel.ts` to Effect v4 at `packages/ai/openai/src/OpenAiLanguageModel.ts`.

This spec covers the core language model implementation. Error mapping is covered in a separate spec: `OPENAI_ERROR_MAPPING.md`.

## Problem Statement

The Effect v4 AI packages need an `OpenAiLanguageModel` implementation that:

1. Provides a `LanguageModel.Service` implementation for OpenAI
2. Converts prompts to OpenAI's Responses API format
3. Converts OpenAI responses back to the generic `Response` format
4. Supports both streaming and non-streaming text generation
5. Handles tool calling (user-defined and provider-defined tools)
6. Integrates with OpenTelemetry for observability

## Design Decisions

| Decision              | Choice                     | Rationale                                             |
| --------------------- | -------------------------- | ----------------------------------------------------- |
| **API Surface**       | Use v3 patterns            | Maintain API consistency for users migrating from v3  |
| **Config Context**    | `Config` service tag       | Allow per-request configuration overrides             |
| **Provider Metadata** | Module augmentation        | Extend `@effect/ai` types with OpenAI-specific fields |
| **Streaming**         | SSE via `Sse.decodeSchema` | Leverage existing v4 SSE infrastructure               |
| **Error Handling**    | Delegate to `OpenAiClient` | Client already maps errors to `AiError`               |

## Implementation Phases

### Phase 1: Core Module Structure

**Goal**: Create the module skeleton and exports.

**Files to create/modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts` (new)
- `packages/ai/openai/src/index.ts` (modify via codegen)

**Tasks**:

- [ ] **1.1** Create `packages/ai/openai/src/OpenAiLanguageModel.ts` with module header and imports
- [ ] **1.2** Add `Model` type alias for allowed model strings
- [ ] **1.3** Create `Config` service tag for per-request configuration
- [ ] **1.4** Add `Config.Service` interface matching v3 structure
- [ ] **1.5** Run `pnpm codegen` to update barrel files
- [ ] **1.6** Run `pnpm check` to verify no type errors

**Verification**: `pnpm check` passes

### Phase 2: Provider Metadata Declarations

**Goal**: Extend Effect AI types with OpenAI-specific metadata via module augmentation.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **2.1** Add module augmentation for `Prompt.FilePartOptions` with OpenAI image detail
- [ ] **2.2** Add module augmentation for `Prompt.ReasoningPartOptions` with itemId, encryptedContent
- [ ] **2.3** Add module augmentation for `Prompt.ToolCallPartOptions` with itemId
- [ ] **2.4** Add module augmentation for `Prompt.TextPartOptions` with itemId
- [ ] **2.5** Add module augmentation for `Response.TextPartMetadata` with itemId, refusal
- [ ] **2.6** Add module augmentation for `Response.TextStartPartMetadata` with itemId
- [ ] **2.7** Add module augmentation for `Response.ReasoningPartMetadata` with itemId, encryptedContent
- [ ] **2.8** Add module augmentation for `Response.ReasoningStartPartMetadata` with itemId, encryptedContent
- [ ] **2.9** Add module augmentation for `Response.ReasoningDeltaPartMetadata` with itemId
- [ ] **2.10** Add module augmentation for `Response.ReasoningEndPartMetadata` with itemId, encryptedContent
- [ ] **2.11** Add module augmentation for `Response.ToolCallPartMetadata` with itemId
- [ ] **2.12** Add module augmentation for `Response.DocumentSourcePartMetadata` with file_citation type and index
- [ ] **2.13** Add module augmentation for `Response.UrlSourcePartMetadata` with url_citation type and indices
- [ ] **2.14** Add module augmentation for `Response.FinishPartMetadata` with serviceTier
- [ ] **2.15** Run `pnpm check` to verify augmentations compile

**Verification**: `pnpm check` passes

### Phase 3: Message Preparation

**Goal**: Implement prompt-to-OpenAI message conversion.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **3.1** Add `getSystemMessageMode` helper for o1/gpt-5/codex models (returns "developer" or "system")
- [ ] **3.2** Implement `prepareMessages` function signature matching v3
- [ ] **3.3** Handle system messages with role determination
- [ ] **3.4** Handle user messages with text parts
- [ ] **3.5** Handle user messages with file parts (images)
- [ ] **3.6** Handle user messages with file parts (PDFs)
- [ ] **3.7** Handle assistant messages with text parts
- [ ] **3.8** Handle assistant messages with reasoning parts (aggregating by itemId)
- [ ] **3.9** Handle assistant messages with tool-call parts
- [ ] **3.10** Handle tool messages with tool-result parts
- [ ] **3.11** Add `isFileId` helper for file ID prefix detection
- [ ] **3.12** Add `getItemId` helper for extracting OpenAI item IDs
- [ ] **3.13** Add `getImageDetail` helper for image detail extraction
- [ ] **3.14** Run `pnpm check` to verify implementation compiles

**Verification**: `pnpm check` passes

### Phase 4: Response Conversion (Non-Streaming)

**Goal**: Implement OpenAI response to generic Response part conversion.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **4.1** Implement `makeResponse` function signature
- [ ] **4.2** Handle `response-metadata` part with id, modelId, timestamp
- [ ] **4.3** Handle `message` output type with `output_text` content
- [ ] **4.4** Handle `message` output type with `refusal` content
- [ ] **4.5** Handle text annotations (file_citation, url_citation)
- [ ] **4.6** Handle `function_call` output type for tool calls
- [ ] **4.7** Handle `code_interpreter_call` output type
- [ ] **4.8** Handle `file_search_call` output type
- [ ] **4.9** Handle `web_search_call` output type
- [ ] **4.10** Handle `reasoning` output type with summary aggregation
- [ ] **4.11** Implement finish part with usage and finish reason
- [ ] **4.12** Add `resolveFinishReason` helper (or import from utilities)
- [ ] **4.13** Run `pnpm check` to verify implementation compiles

**Verification**: `pnpm check` passes

### Phase 5: Response Conversion (Streaming)

**Goal**: Implement streaming response conversion from SSE events.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **5.1** Implement `makeStreamResponse` function signature
- [ ] **5.2** Handle `response.created` event for response-metadata
- [ ] **5.3** Handle `error` event for error parts
- [ ] **5.4** Handle `response.completed`, `response.incomplete`, `response.failed` events for finish
- [ ] **5.5** Handle `response.output_item.added` for text-start, reasoning-start, tool-params-start
- [ ] **5.6** Handle `response.output_item.done` for text-end, reasoning-end, tool-call completion
- [ ] **5.7** Handle `response.output_text.delta` for text-delta parts
- [ ] **5.8** Handle `response.output_text.annotation.added` for source parts
- [ ] **5.9** Handle `response.function_call_arguments.delta` for tool-params-delta
- [ ] **5.10** Handle `response.reasoning_summary_part.added` for additional reasoning starts
- [ ] **5.11** Handle `response.reasoning_summary_text.delta` for reasoning-delta
- [ ] **5.12** Track active tool calls and reasoning parts with mutable state
- [ ] **5.13** Run `pnpm check` to verify implementation compiles

**Verification**: `pnpm check` passes

### Phase 6: Tool Preparation

**Goal**: Convert toolkit tools to OpenAI tool format.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **6.1** Implement `prepareTools` function signature
- [ ] **6.2** Handle empty toolkit case (return undefined)
- [ ] **6.3** Handle `oneOf` tool choice filtering
- [ ] **6.4** Convert user-defined tools to function tool format
- [ ] **6.5** Convert `openai.code_interpreter` provider tool
- [ ] **6.6** Convert `openai.file_search` provider tool
- [ ] **6.7** Convert `openai.web_search` provider tool
- [ ] **6.8** Convert `openai.web_search_preview` provider tool
- [ ] **6.9** Handle unknown provider tool error
- [ ] **6.10** Map tool choice ("auto", "none", "required", specific tool)
- [ ] **6.11** Run `pnpm check` to verify implementation compiles

**Verification**: `pnpm check` passes

### Phase 7: Main Constructor and Accessors

**Goal**: Implement the main `make` constructor and public API.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **7.1** Implement `make` Effect constructor with OpenAiClient dependency
- [ ] **7.2** Implement internal `makeRequest` for building OpenAI request payloads
- [ ] **7.3** Add `prepareInclude` helper for response inclusion options
- [ ] **7.4** Add `prepareResponseFormat` helper for text/json format
- [ ] **7.5** Implement `generateText` method using `LanguageModel.make`
- [ ] **7.6** Implement `streamText` method using `LanguageModel.make`
- [ ] **7.7** Run `pnpm check` to verify implementation compiles

**Verification**: `pnpm check` passes

### Phase 8: Layers and Public API

**Goal**: Implement layers and public convenience functions.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **8.1** Implement `layer` function returning `Layer<LanguageModel.LanguageModel, never, OpenAiClient>`
- [ ] **8.2** Implement `layerWithTokenizer` function (if OpenAiTokenizer is ported)
- [ ] **8.3** Implement `model` function returning `AiModel.Model` (if AiModel is available)
- [ ] **8.4** Implement `modelWithTokenizer` function (if both are available)
- [ ] **8.5** Implement `withConfigOverride` dual function for per-request config
- [ ] **8.6** Export all public types and functions
- [ ] **8.7** Run `pnpm codegen` to update barrel files
- [ ] **8.8** Run `pnpm check` to verify all exports

**Verification**: `pnpm check` passes

### Phase 9: Telemetry Integration

**Goal**: Add OpenTelemetry span annotations.

**Files to create/modify**:

- `packages/ai/openai/src/OpenAiTelemetry.ts` (new, if not exists)
- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **9.1** Create or verify `OpenAiTelemetry.ts` with telemetry attribute types
- [ ] **9.2** Implement `addGenAIAnnotations` for OpenAI-specific attributes
- [ ] **9.3** Add `annotateRequest` helper for request span attributes
- [ ] **9.4** Add `annotateResponse` helper for response span attributes
- [ ] **9.5** Add `annotateStreamResponse` helper for streaming span attributes
- [ ] **9.6** Integrate telemetry calls into `generateText` and `streamText`
- [ ] **9.7** Run `pnpm check` to verify telemetry integration

**Verification**: `pnpm check` passes

### Phase 10: Internal Utilities

**Goal**: Create internal utility module.

**Files to create/modify**:

- `packages/ai/openai/src/internal/utilities.ts` (new)

**Tasks**:

- [ ] **10.1** Create `packages/ai/openai/src/internal/utilities.ts`
- [ ] **10.2** Add `resolveFinishReason` function with finish reason mapping
- [ ] **10.3** Add provider options/metadata key constants
- [ ] **10.4** Run `pnpm check` to verify utilities compile

**Verification**: `pnpm check` passes

### Phase 11: Testing

**Goal**: Add comprehensive tests for OpenAiLanguageModel.

**Files to create/modify**:

- `packages/ai/openai/test/OpenAiLanguageModel.test.ts` (new)

**Tasks**:

- [ ] **11.1** Create test file with test utilities and mocks
- [ ] **11.2** Add tests for `prepareMessages` with various prompt types
- [ ] **11.3** Add tests for `makeResponse` with various response types
- [ ] **11.4** Add tests for `prepareTools` with various tool configurations
- [ ] **11.5** Add integration tests for `generateText` with mocked client
- [ ] **11.6** Add integration tests for `streamText` with mocked client
- [ ] **11.7** Add tests for error handling scenarios
- [ ] **11.8** Run `pnpm test packages/ai/openai/test/OpenAiLanguageModel.test.ts`

**Verification**: All tests pass

### Phase 12: Final Verification

**Goal**: Ensure all quality checks pass.

**Tasks**:

- [ ] **12.1** Run `pnpm lint-fix` to format all files
- [ ] **12.2** Run `pnpm check` to verify type checking
- [ ] **12.3** Run `pnpm test packages/ai/openai` to run all package tests
- [ ] **12.4** Run `pnpm docgen` to verify JSDoc examples compile
- [ ] **12.5** Run `pnpm build` to verify build succeeds

**Verification**: All commands pass with no errors

## Technical Details

### Type Definitions

```typescript
// Model type for allowed model strings
export type Model =
  | typeof Generated.ChatModel.Encoded
  | typeof Generated.ModelIdsResponsesEnum.Encoded

// Config service for per-request configuration
export class Config extends Context.Tag("@effect/ai-openai/OpenAiLanguageModel/Config")<
  Config,
  Config.Service
>() {
  static readonly getOrUndefined: Effect.Effect<Config.Service | undefined>
}

export declare namespace Config {
  interface Service extends
    Partial<
      Omit<
        typeof Generated.CreateResponse.Encoded,
        "input" | "tools" | "tool_choice" | "stream" | "text"
      >
    >
  {
    readonly fileIdPrefixes?: ReadonlyArray<string>
    readonly text?: {
      readonly verbosity?: "low" | "medium" | "high"
    }
  }
}
```

### Module Augmentation Example

```typescript
declare module "effect/unstable/ai/Prompt" {
  export interface FilePartOptions {
    readonly openai?: {
      readonly imageDetail?: "high" | "low" | "auto"
    }
  }
}

declare module "effect/unstable/ai/Response" {
  export interface TextPartMetadata {
    readonly openai?: {
      readonly itemId?: string
      readonly refusal?: string
    }
  }
}
```

### Constructor Pattern

```typescript
export const make = Effect.fnUntraced(function*(options: {
  readonly model: (string & {}) | Model
  readonly config?: Omit<Config.Service, "model">
}) {
  const client = yield* OpenAiClient

  const makeRequest = Effect.fnUntraced(function*(providerOptions) {
    const context = yield* Effect.context<never>()
    const config = { model: options.model, ...options.config, ...context.unsafeMap.get(Config.key) }
    // Build request...
  })

  return yield* LanguageModel.make({
    generateText: Effect.fnUntraced(function*(options) {
      const request = yield* makeRequest(options)
      const rawResponse = yield* client.createResponse(request)
      return yield* makeResponse(rawResponse, options)
    }),
    streamText: Effect.fnUntraced(function*(options) {
      const request = yield* makeRequest(options)
      return client.createResponseStream(request)
    }, (effect, options) => /* stream transformation */)
  })
})
```

## Dependencies

- `OpenAiClient` - Already implemented in v4
- `Generated` - OpenAI schema types (already exists)
- `LanguageModel` - From `effect/unstable/ai/LanguageModel`
- `AiError` - From `effect/unstable/ai/AiError`

## Related Specs

- `OPENAI_ERROR_MAPPING.md` - Granular error mapping for OpenAI-specific errors
