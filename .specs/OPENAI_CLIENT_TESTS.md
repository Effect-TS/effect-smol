# OpenAiClient Test Specification

**Status: DRAFT**

## Overview

This specification defines the testing strategy for the `@effect/ai-openai/OpenAiClient` module. Tests validate behavior without hitting the OpenAI API by using mock HTTP clients.

## Problem Statement

The `OpenAiClient` module provides a type-safe, Effect-based client for OpenAI operations. It needs comprehensive test coverage to ensure:

- Service construction with various configuration options
- HTTP request/response handling
- Error mapping from HTTP errors to `AiError` types
- SSE streaming for response events
- Layer composition and dependency injection

## Design Decisions

| Decision           | Choice                                               | Rationale                                           |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| **Mock Strategy**  | Create mock `HttpClient` using `HttpClient.makeWith` | Avoids network calls, enables deterministic testing |
| **Test Framework** | Use `it.effect` from `@effect/vitest`                | Follows codebase conventions                        |
| **Assertions**     | Use `assert` from `@effect/vitest`                   | Avoid vitest `expect` in Effect tests               |
| **SSE Testing**    | Generate SSE event strings directly                  | Test SSE parsing without network                    |

## Implementation Phases

### Phase 1: Test Infrastructure

**Goal**: Create test utilities for mocking HTTP responses.

**Files to create/modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts` (new)

**Tasks**:

- [ ] **1.1** Create test file with imports:
  - `{ assert, describe, it }` from `@effect/vitest`
  - `Effect, Layer, Redacted, Schema, Stream` from `effect`
  - `HttpClient, HttpClientRequest, HttpClientResponse, HttpClientError` from `effect/unstable/http`
  - `AiError` from `effect/unstable/ai`
  - `OpenAiClient` from module under test
  - `Generated` schemas from module under test

- [ ] **1.2** Create `makeMockHttpClient` helper function:
  ```typescript
  const makeMockHttpClient = (
    handler: (
      request: HttpClientRequest.HttpClientRequest
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>
  ): HttpClient.HttpClient =>
    HttpClient.makeWith(
      (effect) => Effect.flatMap(effect, handler),
      Effect.succeed
    )
  ```

- [ ] **1.3** Create `makeMockResponse` helper for JSON responses:
  ```typescript
  const makeMockResponse = (options: {
    readonly status: number
    readonly body: unknown
    readonly request?: HttpClientRequest.HttpClientRequest
  }): HttpClientResponse.HttpClientResponse
  ```

- [ ] **1.4** Create `makeMockStreamResponse` helper for SSE responses:
  ```typescript
  const makeMockStreamResponse = (options: {
    readonly status: number
    readonly events: Array<{ event?: string; data: unknown }>
    readonly request?: HttpClientRequest.HttpClientRequest
  }): HttpClientResponse.HttpClientResponse
  ```

- [ ] **1.5** Run `pnpm lint-fix` on test file

**Verification**: File compiles without errors

---

### Phase 2: Service Construction Tests

**Goal**: Test `OpenAiClient.make` and layer construction.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **2.1** Add `describe("OpenAiClient")` block

- [ ] **2.2** Add `describe("make")` tests:
  - [ ] **2.2.1** Test basic construction with required options (apiKey)
  - [ ] **2.2.2** Test construction with custom apiUrl
  - [ ] **2.2.3** Test construction with organizationId header
  - [ ] **2.2.4** Test construction with projectId header
  - [ ] **2.2.5** Test construction with transformClient option

- [ ] **2.3** Add `describe("layer")` tests:
  - [ ] **2.3.1** Test `layer` creates working service
  - [ ] **2.3.2** Test `layerConfig` loads from Config

- [ ] **2.4** Run `pnpm lint-fix`
- [ ] **2.5** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

### Phase 3: Request Configuration Tests

**Goal**: Verify HTTP requests are configured correctly.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **3.1** Add `describe("request configuration")` block

- [ ] **3.2** Test Bearer token is set from apiKey:
  ```typescript
  it.effect("sets Bearer token from apiKey", () =>
    Effect.gen(function*() {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined
      // Create mock that captures request, verify Authorization header
    }))
  ```

- [ ] **3.3** Test URL prepending:
  - [ ] **3.3.1** Test default URL `https://api.openai.com/v1`
  - [ ] **3.3.2** Test custom apiUrl is prepended

- [ ] **3.4** Test optional headers:
  - [ ] **3.4.1** Test OpenAI-Organization header when organizationId provided
  - [ ] **3.4.2** Test OpenAI-Project header when projectId provided
  - [ ] **3.4.3** Test headers absent when options not provided

- [ ] **3.5** Run `pnpm lint-fix`
- [ ] **3.6** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

### Phase 4: Error Mapping Tests

**Goal**: Verify HTTP errors map to correct `AiError` types.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **4.1** Add `describe("error mapping")` block

- [ ] **4.2** Test `mapRequestError`:
  - [ ] **4.2.1** Test RequestError maps to AiError with NetworkError reason
  - [ ] **4.2.2** Verify module is "OpenAiClient"
  - [ ] **4.2.3** Verify method name is preserved

- [ ] **4.3** Test `mapResponseError`:
  - [ ] **4.3.1** Test 400 status maps to InvalidRequestError reason
  - [ ] **4.3.2** Test 401 status maps to AuthenticationError reason
  - [ ] **4.3.3** Test 403 status maps to AuthenticationError (InsufficientPermissions)
  - [ ] **4.3.4** Test 429 status maps to RateLimitError reason
  - [ ] **4.3.5** Test 5xx status maps to ProviderInternalError reason

- [ ] **4.4** Test `mapSchemaError`:
  - [ ] **4.4.1** Test SchemaError maps to AiError with OutputParseError reason
  - [ ] **4.4.2** Verify error contains schema context

- [ ] **4.5** Run `pnpm lint-fix`
- [ ] **4.6** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

### Phase 5: createResponse Tests

**Goal**: Test non-streaming response creation.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **5.1** Add `describe("createResponse")` block

- [ ] **5.2** Test successful response:
  - [ ] **5.2.1** Mock HTTP client returns valid Response JSON
  - [ ] **5.2.2** Verify decoded response matches Generated.Response schema
  - [ ] **5.2.3** Verify request body contains correct payload

- [ ] **5.3** Test error responses:
  - [ ] **5.3.1** Test 400 error returns AiError
  - [ ] **5.3.2** Test 401 error returns AiError
  - [ ] **5.3.3** Test 500 error returns AiError

- [ ] **5.4** Test schema validation:
  - [ ] **5.4.1** Test malformed response body returns SchemaError mapped to AiError

- [ ] **5.5** Run `pnpm lint-fix`
- [ ] **5.6** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

### Phase 6: createResponseStream Tests

**Goal**: Test SSE streaming response creation.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **6.1** Add `describe("createResponseStream")` block

- [ ] **6.2** Test SSE parsing:
  - [ ] **6.2.1** Create mock SSE response with multiple events
  - [ ] **6.2.2** Verify stream emits decoded ResponseStreamEvent items
  - [ ] **6.2.3** Verify stream completes after all events

- [ ] **6.3** Test stream sets `stream: true` in request body

- [ ] **6.4** Test error handling:
  - [ ] **6.4.1** Test HTTP error before stream starts
  - [ ] **6.4.2** Test malformed SSE data returns AiError

- [ ] **6.5** Run `pnpm lint-fix`
- [ ] **6.6** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

### Phase 7: createEmbedding Tests

**Goal**: Test embedding creation endpoint.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **7.1** Add `describe("createEmbedding")` block

- [ ] **7.2** Test successful embedding:
  - [ ] **7.2.1** Mock HTTP client returns valid CreateEmbeddingResponse JSON
  - [ ] **7.2.2** Verify decoded response matches schema
  - [ ] **7.2.3** Verify request contains model and input

- [ ] **7.3** Test error responses:
  - [ ] **7.3.1** Test 400 error (invalid model)
  - [ ] **7.3.2** Test 429 error (rate limit)

- [ ] **7.4** Run `pnpm lint-fix`
- [ ] **7.5** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

### Phase 8: streamRequest Tests

**Goal**: Test generic SSE streaming with custom schemas.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **8.1** Add `describe("streamRequest")` block

- [ ] **8.2** Test custom schema decoding:
  - [ ] **8.2.1** Create custom schema for test events
  - [ ] **8.2.2** Mock SSE response matching custom schema
  - [ ] **8.2.3** Verify stream decodes using provided schema

- [ ] **8.3** Test error propagation:
  - [ ] **8.3.1** Test RequestError maps correctly
  - [ ] **8.3.2** Test ResponseError maps correctly
  - [ ] **8.3.3** Test SchemaError maps correctly

- [ ] **8.4** Run `pnpm lint-fix`
- [ ] **8.5** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

### Phase 9: OpenAiConfig Integration Tests

**Goal**: Test `OpenAiConfig` service integration with client.

**Files to modify**:

- `packages/ai/openai/test/OpenAiClient.test.ts`

**Tasks**:

- [ ] **9.1** Add `describe("OpenAiConfig integration")` block

- [ ] **9.2** Test transformClient from OpenAiConfig:
  - [ ] **9.2.1** Provide OpenAiConfig with transformClient
  - [ ] **9.2.2** Verify Generated client uses transformed HttpClient
  - [ ] **9.2.3** Verify transformation applies to requests

- [ ] **9.3** Test without OpenAiConfig:
  - [ ] **9.3.1** Verify client works when OpenAiConfig not provided

- [ ] **9.4** Run `pnpm lint-fix`
- [ ] **9.5** Run `pnpm test OpenAiClient.test.ts`

**Verification**: `pnpm test OpenAiClient.test.ts` passes

---

## Technical Details

### Mock Response Factory

```typescript
import { Effect, Stream } from "effect"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

const makeMockResponse = (options: {
  readonly status: number
  readonly body: unknown
  readonly request?: HttpClientRequest.HttpClientRequest
}): HttpClientResponse.HttpClientResponse => {
  const request = options.request ?? HttpClientRequest.get("/")
  const json = JSON.stringify(options.body)
  return HttpClientResponse.fromWeb(
    request,
    new Response(json, {
      status: options.status,
      headers: { "content-type": "application/json" }
    })
  )
}

const makeMockStreamResponse = (options: {
  readonly status: number
  readonly events: Array<{ event?: string; data: unknown }>
  readonly request?: HttpClientRequest.HttpClientRequest
}): HttpClientResponse.HttpClientResponse => {
  const request = options.request ?? HttpClientRequest.get("/")
  const sseText = options.events
    .map((e) => {
      let line = ""
      if (e.event) line += `event: ${e.event}\n`
      line += `data: ${JSON.stringify(e.data)}\n\n`
      return line
    })
    .join("")
  return HttpClientResponse.fromWeb(
    request,
    new Response(sseText, {
      status: options.status,
      headers: { "content-type": "text/event-stream" }
    })
  )
}
```

### Sample Test Data

```typescript
// Sample Response (minimal valid structure)
const sampleResponse = {
  id: "resp_123",
  object: "response",
  created_at: 1700000000,
  status: "completed",
  model: "gpt-4o",
  output: []
}

// Sample CreateEmbeddingResponse
const sampleEmbeddingResponse = {
  object: "list",
  data: [{
    object: "embedding",
    index: 0,
    embedding: [0.1, 0.2, 0.3]
  }],
  model: "text-embedding-ada-002",
  usage: {
    prompt_tokens: 5,
    total_tokens: 5
  }
}

// Sample ResponseStreamEvent
const sampleStreamEvents = [
  { type: "response.created", response: { id: "resp_123", object: "response", status: "in_progress" } },
  { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "item_1" } },
  { type: "response.done", response: { id: "resp_123", object: "response", status: "completed" } }
]
```

## Testing Requirements

### Unit Tests

- Service construction with all option combinations
- Request header and URL configuration
- Error mapping for all HTTP status codes
- Schema validation errors
- SSE parsing and streaming

### Integration Tests

- Layer composition with HttpClient dependency
- Config-based layer with environment variables
- OpenAiConfig transformClient integration

## Final Verification

Run all validation commands:

```bash
pnpm lint-fix
pnpm check
pnpm test OpenAiClient.test.ts
pnpm docgen
```

All commands must pass without errors.
