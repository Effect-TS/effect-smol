# OpenAI Error Mapping to AiError

**Status: COMPLETED**

## Overview

Define granular error mapping from OpenAI API responses to Effect v4's `AiError` reason types. This enables end users to handle specific error cases with precise matching and take appropriate remediation actions.

## Problem Statement

The current `OpenAiClient` uses `reasonFromHttpStatus` for basic HTTP status code mapping, but OpenAI provides rich error information in response bodies that should be surfaced to users:

1. **Error codes** - `rate_limit_exceeded`, `invalid_api_key`, `context_length_exceeded`, etc.
2. **Error types** - Categorization of errors by OpenAI
3. **Rate limit headers** - `x-ratelimit-*`, `retry-after` headers
4. **Content filter results** - Safety system blocks, content policy violations
5. **Model-specific errors** - Model not found, deprecated, overloaded

Users need to:

- Implement retry logic based on `isRetryable` and `retryAfter`
- Display user-friendly error messages
- Handle specific error cases (rate limits vs auth vs content policy)
- Log structured error information for debugging

## Design Decisions

| Decision               | Choice                          | Rationale                                       |
| ---------------------- | ------------------------------- | ----------------------------------------------- |
| **Error Body Parsing** | Parse JSON body before mapping  | Extract OpenAI error codes/types                |
| **Rate Limit Headers** | Parse `x-ratelimit-*` headers   | Populate `RateLimitError` with limits/remaining |
| **Retry-After**        | Parse `retry-after` header      | Convert to `Duration` for `retryAfter` field    |
| **Provider Metadata**  | Include OpenAI-specific context | Preserve original error code/type/requestId     |
| **HTTP Context**       | Include full request/response   | Enable debugging with complete context          |

## Implementation Phases

### Phase 1: OpenAI Error Response Schema

**Goal**: Define schemas for parsing OpenAI error responses.

**Files to create/modify**:

- `packages/ai/openai/src/OpenAiError.ts` (new)

**Tasks**:

- [x] **1.1** Create `packages/ai/openai/src/OpenAiError.ts` module
- [x] **1.2** Define `OpenAiErrorBody` schema for standard error response structure:
  ```typescript
  Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      type: Schema.String,
      param: Schema.optional(Schema.NullOr(Schema.String)),
      code: Schema.optional(Schema.NullOr(Schema.String))
    })
  })
  ```
- [x] **1.3** Define `OpenAiErrorCode` literal union for known error codes
- [x] **1.4** Define `OpenAiErrorType` literal union for known error types
- [x] **1.5** Run `pnpm codegen` to update barrel files
- [x] **1.6** Run `pnpm check` to verify schemas compile

**Verification**: `pnpm check` passes

### Phase 2: Rate Limit Header Parsing

**Goal**: Extract rate limit information from response headers.

**Files to modify**:

- `packages/ai/openai/src/OpenAiError.ts`

**Tasks**:

- [x] **2.1** Define `OpenAiRateLimitHeaders` interface:
  ```typescript
  interface OpenAiRateLimitHeaders {
    limit: string | undefined // x-ratelimit-limit-requests
    remaining: number | undefined // x-ratelimit-remaining-requests
    reset: Date | undefined // x-ratelimit-reset-requests
    retryAfter: Duration | undefined // retry-after (seconds)
  }
  ```
- [x] **2.2** Implement `parseRateLimitHeaders` function to extract headers
- [x] **2.3** Handle both `retry-after` (seconds) and `x-ratelimit-reset-*` (timestamp)
- [x] **2.4** Convert reset timestamp to `Duration` when possible
- [x] **2.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 3: Error Code Mapping

**Goal**: Map OpenAI error codes to `AiErrorReason` types.

**Files to modify**:

- `packages/ai/openai/src/OpenAiError.ts`

**Tasks**:

- [x] **3.1** Create `mapOpenAiErrorCode` function with signature:
  ```typescript
  ;((params: {
    code: string | null | undefined
    type: string
    message: string
    status: number
    headers: Record<string, string>
    body: unknown
  }) => AiErrorReason)
  ```
- [x] **3.2** Map `rate_limit_exceeded` code to `RateLimitError`:
  - Extract rate limit headers
  - Set `limit` from header or infer from message
  - Set `retryAfter` from `retry-after` or `x-ratelimit-reset-*`
- [x] **3.3** Map `insufficient_quota` code to `QuotaExhaustedError`:
  - Set `quotaType` to "tokens" or infer from message
- [x] **3.4** Map `invalid_api_key` code to `AuthenticationError`:
  - Set `kind` to "InvalidKey"
- [x] **3.5** Map `incorrect_api_key` code to `AuthenticationError`:
  - Set `kind` to "InvalidKey"
- [x] **3.6** Map authentication-related types to `AuthenticationError`:
  - `authentication_error` → "InvalidKey"
  - `permission_error` → "InsufficientPermissions"
- [x] **3.7** Map `context_length_exceeded` code to `ContextLengthError`:
  - Parse `maxTokens` and `requestedTokens` from message if present
- [x] **3.8** Map `model_not_found` code to `ModelUnavailableError`:
  - Set `kind` to "NotFound"
  - Extract model name from message
- [x] **3.9** Map `model_overloaded` to `ModelUnavailableError`:
  - Set `kind` to "Overloaded"
- [x] **3.10** Map `invalid_request_error` type to `InvalidRequestError`:
  - Extract `parameter` and `constraint` from message if possible
- [x] **3.11** Map `content_policy_violation` to `ContentPolicyError`:
  - Set `violationType` from code or message
  - Set `flaggedInput` to true
- [x] **3.12** Map `safety_system` blocks to `ContentPolicyError`:
  - Extract violation type from message
- [x] **3.13** Map `server_error` type to `ProviderInternalError`
- [x] **3.14** Map 5xx status codes without specific code to `ProviderInternalError`
- [x] **3.15** Add fallback to `AiUnknownError` for unmapped cases
- [x] **3.16** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 4: HTTP Context Builder

**Goal**: Build `HttpContext` for error reporting.

**Files to modify**:

- `packages/ai/openai/src/OpenAiError.ts`

**Tasks**:

- [x] **4.1** Implement `buildHttpContext` function:
  ```typescript
  ;((params: {
    request: HttpClientRequest.HttpClientRequest
    response?: HttpClientResponse.HttpClientResponse
    body?: string
  }) => typeof AiError.HttpContext.Type)
  ```
- [x] **4.2** Extract request details (method, url, urlParams, headers)
- [x] **4.3** Extract response details (status, headers)
- [x] **4.4** Redact sensitive headers (Authorization, API keys)
- [x] **4.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 5: Provider Metadata Builder

**Goal**: Build `ProviderMetadata` for error context.

**Files to modify**:

- `packages/ai/openai/src/OpenAiError.ts`

**Tasks**:

- [x] **5.1** Implement `buildProviderMetadata` function:
  ```typescript
  ;((params: {
    errorCode?: string
    errorType?: string
    requestId?: string
    raw?: unknown
  }) => typeof AiError.ProviderMetadata.Type)
  ```
- [x] **5.2** Set `name` to "OpenAI"
- [x] **5.3** Extract `x-request-id` header for `requestId`
- [x] **5.4** Preserve raw error body in `raw` field
- [x] **5.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 6: Main Error Mapping Function

**Goal**: Create the main error mapping entry point.

**Files to modify**:

- `packages/ai/openai/src/OpenAiError.ts`

**Tasks**:

- [x] **6.1** Implement `mapResponseError` function:
  ```typescript
  ;((params: {
    method: string
    error: HttpClientError.ResponseError
  }) => Effect.Effect<never, AiError.AiError>)
  ```
- [x] **6.2** Parse response body as JSON
- [x] **6.3** Decode body using `OpenAiErrorBody` schema
- [x] **6.4** Extract error code, type, message from decoded body
- [x] **6.5** Call `mapOpenAiErrorCode` with extracted values
- [x] **6.6** Build `HttpContext` and `ProviderMetadata`
- [x] **6.7** Construct and return `AiError` with reason
- [x] **6.8** Handle body parsing failures gracefully (fallback to status-based mapping)
- [x] **6.9** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 7: Update OpenAiClient Error Mapping

**Goal**: Integrate granular error mapping into `OpenAiClient`.

**Files to modify**:

- `packages/ai/openai/src/OpenAiClient.ts`

**Tasks**:

- [x] **7.1** Import error mapping functions from `OpenAiError`
- [x] **7.2** Update `mapResponseError` to use new mapping:
  ```typescript
  const mapResponseError = dual<
    (method: string) => (error: HttpClientError.ResponseError) => Effect.Effect<never, AiError.AiError>,
    (error: HttpClientError.ResponseError, method: string) => Effect.Effect<never, AiError.AiError>
  >(2, (error, method) => OpenAiError.mapResponseError({ method, error }))
  ```
- [x] **7.3** Update `createResponse` to use effectful error mapping
- [x] **7.4** Update `createResponseStream` to use effectful error mapping
- [x] **7.5** Update `createEmbedding` to use effectful error mapping
- [x] **7.6** Update `streamRequest` to use effectful error mapping
- [x] **7.7** Run `pnpm check` to verify integration

**Verification**: `pnpm check` passes

### Phase 8: Testing

**Goal**: Add comprehensive tests for error mapping.

**Files to create/modify**:

- `packages/ai/openai/test/OpenAiError.test.ts` (new)

**Tasks**:

- [x] **8.1** Create test file with test utilities
- [x] **8.2** Add tests for `parseRateLimitHeaders`:
  - With all headers present
  - With partial headers
  - With no headers
  - With various formats
- [x] **8.3** Add tests for `mapOpenAiErrorCode` with rate limit errors:
  - `rate_limit_exceeded` code
  - 429 status with headers
- [x] **8.4** Add tests for authentication errors:
  - `invalid_api_key` code
  - `incorrect_api_key` code
  - 401 status
  - 403 status
- [x] **8.5** Add tests for context length errors:
  - `context_length_exceeded` code
  - With token counts in message
- [x] **8.6** Add tests for model errors:
  - `model_not_found` code
  - `model_overloaded` code
- [x] **8.7** Add tests for content policy errors:
  - `content_policy_violation` code
  - `safety_system` block
- [x] **8.8** Add tests for server errors:
  - 500 status
  - 502 status
  - 503 status
- [x] **8.9** Add tests for unknown errors (fallback behavior)
- [x] **8.10** Add integration tests with mocked HTTP responses
- [x] **8.11** Run `pnpm test packages/ai/openai/test/OpenAiError.test.ts`

**Verification**: All tests pass

### Phase 9: Final Verification

**Goal**: Ensure all quality checks pass.

**Tasks**:

- [x] **9.1** Run `pnpm lint-fix` to format all files
- [x] **9.2** Run `pnpm check` to verify type checking
- [x] **9.3** Run `pnpm test packages/ai/openai` to run all package tests
- [x] **9.4** Run `pnpm docgen` to verify JSDoc examples compile
- [x] **9.5** Run `pnpm build` to verify build succeeds

**Verification**: All commands pass with no errors

## Technical Details

### OpenAI Error Response Structure

```typescript
// Standard error response from OpenAI
interface OpenAiErrorResponse {
  error: {
    message: string
    type: string
    param: string | null
    code: string | null
  }
}

// Example: Rate limit error
{
  "error": {
    "message": "Rate limit reached for gpt-4 in organization org-xxx on requests per min.",
    "type": "requests",
    "param": null,
    "code": "rate_limit_exceeded"
  }
}

// Example: Context length error
{
  "error": {
    "message": "This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.",
    "type": "invalid_request_error",
    "param": "messages",
    "code": "context_length_exceeded"
  }
}
```

### Known OpenAI Error Codes

```typescript
type OpenAiErrorCode =
  // Rate limiting
  | "rate_limit_exceeded"
  // Quota/billing
  | "insufficient_quota"
  | "billing_hard_limit_reached"
  // Authentication
  | "invalid_api_key"
  | "incorrect_api_key"
  // Context/tokens
  | "context_length_exceeded"
  | "max_tokens_exceeded"
  // Model
  | "model_not_found"
  | "model_overloaded"
  // Content policy
  | "content_policy_violation"
  | "safety_system"
  // Request validation
  | "invalid_request_error"
  | "invalid_parameter_value"
```

### Rate Limit Headers

```
x-ratelimit-limit-requests: 10000
x-ratelimit-limit-tokens: 1000000
x-ratelimit-remaining-requests: 9999
x-ratelimit-remaining-tokens: 999500
x-ratelimit-reset-requests: 6ms
x-ratelimit-reset-tokens: 30ms
retry-after: 60
```

### Error Mapping Examples

```typescript
// Rate limit with full context
AiError.make({
  module: "OpenAiClient",
  method: "createResponse",
  reason: new AiError.RateLimitError({
    limit: "requests",
    remaining: 0,
    retryAfter: Duration.seconds(60),
    resetAt: DateTime.unsafeNow(),
    provider: {
      name: "OpenAI",
      errorCode: "rate_limit_exceeded",
      errorType: "requests",
      requestId: "req_abc123"
    },
    http: {
      request: { method: "POST", url: "https://api.openai.com/v1/responses", ... },
      response: { status: 429, headers: { ... } }
    }
  })
})

// Context length with token info
AiError.make({
  module: "OpenAiClient",
  method: "createResponse",
  reason: new AiError.ContextLengthError({
    maxTokens: 8192,
    requestedTokens: 12000,
    provider: {
      name: "OpenAI",
      errorCode: "context_length_exceeded",
      errorType: "invalid_request_error"
    }
  })
})

// Content policy with flagged content
AiError.make({
  module: "OpenAiClient",
  method: "createResponse",
  reason: new AiError.ContentPolicyError({
    violationType: "hate",
    flaggedInput: true,
    provider: {
      name: "OpenAI",
      errorCode: "content_policy_violation"
    }
  })
})
```

### User-Facing Error Handling Example

```typescript
import { Effect, Match, Schedule } from "effect"
import { AiError, LanguageModel } from "effect/unstable/ai"

const generateWithRetry = LanguageModel.generateText({
  prompt: "Hello, world!"
}).pipe(
  Effect.retry(
    Schedule.exponential("1 second").pipe(
      Schedule.whileInput((error: AiError.AiError) => error.isRetryable),
      Schedule.compose(Schedule.recurs(3))
    )
  ),
  Effect.catchTag("AiError", (error) =>
    Match.value(error.reason).pipe(
      Match.tag("RateLimitError", (reason) => {
        console.log(`Rate limited. Retry after ${reason.retryAfter}`)
        return Effect.fail(error)
      }),
      Match.tag("AuthenticationError", (reason) => {
        console.log(`Auth error: ${reason.kind}. Check your API key.`)
        return Effect.fail(error)
      }),
      Match.tag("ContextLengthError", (reason) => {
        console.log(`Too many tokens: ${reason.requestedTokens}/${reason.maxTokens}`)
        return Effect.fail(error)
      }),
      Match.tag("ContentPolicyError", (reason) => {
        console.log(`Content blocked: ${reason.violationType}`)
        return Effect.fail(error)
      }),
      Match.orElse(() => Effect.fail(error))
    ))
)
```

## Related Specs

- `OPENAI_LANGUAGE_MODEL_PORT.md` - Main language model implementation
