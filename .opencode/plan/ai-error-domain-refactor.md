# AI SDK Error Domain Model Refactoring

## Status: READY FOR IMPLEMENTATION

## Decisions Made

- **Breaking change**: Acceptable
- **Schema requirement**: Yes - use `Schema.TaggedError` for serialization
- **`providerDetails` typing**: `unknown` for now

---

## Executive Summary

Complete refactoring of the `AiError` domain model in the Effect AI SDK to provide rich error context, semantic error types, provider metadata preservation, and explicit retry guidance.

---

## Problem Statement

The current `AiError` implementation has significant gaps:

1. **HTTP error mapping incomplete** - OpenAI provider has HTTP error mapping commented out (lines 100-112 in `OpenAiClient.ts`)
2. **No semantic error types** - Rate limits, authentication, content filtering lumped into generic HTTP errors
3. **Missing provider context** - Request IDs, rate limit headers, error codes not preserved
4. **No retry guidance** - Users must manually interpret errors to determine retryability
5. **Tool errors conflated** - Validation vs execution failures use same error types (`MalformedInput`/`MalformedOutput`)
6. **Critical distinction missing** - Rate limits (retryable) vs quota exceeded (not retryable) both return HTTP 429 but require different handling

---

## Design Principles

1. **Discriminated unions with `Schema.TaggedError`** - Pattern matching with `catchTag`/`catchTags`, serializable
2. **Rich context by default** - Every error carries actionable information
3. **Preserve provider details** - Original errors and provider metadata via `cause` and `providerDetails`
4. **Explicit retry guidance** - Every error declares `isRetryable` and `retryAfter`

---

## Error Taxonomy

```
AiError (union)
├── NetworkError
│   ├── ConnectionError           # Network unreachable, DNS failure
│   └── TimeoutError              # Request/response timeout
│
├── AuthenticationError           # 401 - Invalid/expired credentials
├── PermissionDeniedError         # 403 - Insufficient permissions
│
├── RateLimitError                # 429 - RETRYABLE rate limit (requests/tokens)
├── QuotaExceededError            # 429 - NOT RETRYABLE billing/quota issue ⚠️
│
├── InputError
│   ├── InvalidRequestError       # 400 - Malformed request, invalid params
│   └── TokenLimitExceededError   # Context length exceeded (with token counts)
│
├── ContentError
│   ├── ContentFilteredError      # Content filtered by safety system
│   └── ContentPolicyViolationError # Policy violation
│
├── ModelError
│   ├── ModelNotFoundError        # 404 - Model doesn't exist
│   └── ModelOverloadedError      # 529/503 - Model capacity issue
│
├── ToolError
│   ├── ToolNotFoundError         # Tool name not in toolkit
│   ├── ToolParameterError        # Invalid tool parameters from LLM
│   ├── ToolExecutionError        # Tool handler failed
│   └── ToolResultEncodingError   # Tool result couldn't be encoded
│
├── StreamingError
│   └── StreamInterruptedError    # Stream ended unexpectedly (with partial content)
│
├── ResponseError
│   ├── MalformedResponseError    # Response couldn't be parsed
│   └── EmptyResponseError        # No content in response
│
├── ProviderError                 # 500/502 - Server-side errors
│
└── UnknownError                  # Catch-all for unexpected errors
```

---

## Base Error Interface

All AI errors share common properties:

```typescript
interface AiErrorBase {
  // Identification
  readonly requestId?: string          // From provider response headers
  readonly timestamp: Date             // When error occurred
  
  // Operation Context
  readonly operation: AiOperation      // What operation failed
  readonly model?: string              // Which model (if applicable)
  readonly provider: AiProvider        // Which provider
  
  // User-Actionable Information  
  readonly message: string             // Human-readable description
  readonly suggestion: string          // What can user do to fix
  readonly documentationUrl?: string   // Link to relevant docs
  
  // Retry Guidance
  readonly isRetryable: boolean        // Should caller retry?
  readonly retryAfter?: Duration       // Suggested wait time (if retryable)
  
  // Developer Debugging
  readonly code: AiErrorCode           // Machine-readable, API-stable code
  readonly cause?: unknown             // Original error for chaining
  readonly providerDetails?: unknown   // Provider-specific error info
}

type AiOperation = 
  | "generateText" | "streamText" | "generateObject" | "streamObject"
  | "generateEmbedding" | "toolCall" | "toolExecution" | "tokenize" | "truncate"

type AiProvider = 
  | "openai" | "anthropic" | "google" | "bedrock" | "azure" | "ollama" | "unknown"
```

---

## Error Code Catalog

```typescript
const AiErrorCode = {
  // Network
  CONNECTION_FAILED: "CONNECTION_FAILED",
  TIMEOUT: "TIMEOUT",
  
  // Authentication
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  
  // Rate Limiting (CRITICAL: These are distinct!)
  RATE_LIMITED: "RATE_LIMITED",           // Retryable
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",       // NOT retryable
  
  // Input Validation
  INVALID_REQUEST: "INVALID_REQUEST",
  TOKEN_LIMIT_EXCEEDED: "TOKEN_LIMIT_EXCEEDED",
  
  // Content Safety
  CONTENT_FILTERED: "CONTENT_FILTERED",
  CONTENT_POLICY_VIOLATION: "CONTENT_POLICY_VIOLATION",
  
  // Model/Resource
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  MODEL_OVERLOADED: "MODEL_OVERLOADED",
  
  // Tool Errors
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  TOOL_PARAMETER_INVALID: "TOOL_PARAMETER_INVALID",
  TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
  TOOL_RESULT_ENCODING_FAILED: "TOOL_RESULT_ENCODING_FAILED",
  
  // Streaming
  STREAM_INTERRUPTED: "STREAM_INTERRUPTED",
  
  // Response
  MALFORMED_RESPONSE: "MALFORMED_RESPONSE",
  EMPTY_RESPONSE: "EMPTY_RESPONSE",
  
  // Server
  PROVIDER_ERROR: "PROVIDER_ERROR",
  
  // Unknown
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const
```

---

## Key Error Type Details

### Rate Limit vs Quota (CRITICAL)

```typescript
/**
 * RETRYABLE - Rate limit resets after period
 */
class RateLimitError extends Schema.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    operation: AiOperation,
    provider: AiProvider,
    model: Schema.optional(Schema.String),
    requestId: Schema.optional(Schema.String),
    timestamp: Schema.Date,
    limitType: Schema.Literal(
      "requests_per_minute", "tokens_per_minute", 
      "requests_per_day", "tokens_per_day", "concurrent", "unknown"
    ),
    limit: Schema.optional(Schema.Number),
    remaining: Schema.optional(Schema.Number),
    resetAt: Schema.optional(Schema.Date),
    retryAfterMs: Schema.optional(Schema.Number),
    providerDetails: Schema.optional(Schema.Unknown),
  }
) {
  readonly code = AiErrorCode.RATE_LIMITED
  readonly isRetryable = true
  
  get retryAfter(): Duration | undefined {
    return this.retryAfterMs ? Duration.millis(this.retryAfterMs) : undefined
  }
  
  get suggestion(): string {
    return "Implement exponential backoff. Consider reducing request frequency."
  }
}

/**
 * NOT RETRYABLE - Requires billing action
 * OpenAI returns 429 for BOTH - must check error code!
 */
class QuotaExceededError extends Schema.TaggedError<QuotaExceededError>()(
  "QuotaExceededError",
  {
    operation: AiOperation,
    provider: AiProvider,
    model: Schema.optional(Schema.String),
    requestId: Schema.optional(Schema.String),
    timestamp: Schema.Date,
    quotaType: Schema.Literal("monthly_spend", "token_budget", "request_budget", "unknown"),
    limit: Schema.optional(Schema.Number),
    used: Schema.optional(Schema.Number),
    resetAt: Schema.optional(Schema.Date),
    providerDetails: Schema.optional(Schema.Unknown),
  }
) {
  readonly code = AiErrorCode.QUOTA_EXCEEDED
  readonly isRetryable = false  // User must add billing!
  
  get suggestion(): string {
    return "Billing quota exceeded. Add payment method or increase spending limits."
  }
}
```

### Token Limit Exceeded

```typescript
class TokenLimitExceededError extends Schema.TaggedError<TokenLimitExceededError>()(
  "TokenLimitExceededError",
  {
    operation: AiOperation,
    provider: AiProvider,
    model: Schema.String,  // Required
    requestId: Schema.optional(Schema.String),
    timestamp: Schema.Date,
    requestedTokens: Schema.Number,
    maxTokens: Schema.Number,
    inputTokens: Schema.optional(Schema.Number),
    outputTokens: Schema.optional(Schema.Number),
    providerDetails: Schema.optional(Schema.Unknown),
  }
) {
  readonly code = AiErrorCode.TOKEN_LIMIT_EXCEEDED
  readonly isRetryable = false
  
  get overage(): number {
    return this.requestedTokens - this.maxTokens
  }
  
  get suggestion(): string {
    return `Reduce input by at least ${this.overage} tokens.`
  }
}
```

### Content Filtered

```typescript
const ContentFilterResult = Schema.Struct({
  hate: Schema.optional(Schema.Struct({
    filtered: Schema.Boolean,
    severity: Schema.optional(Schema.Literal("safe", "low", "medium", "high"))
  })),
  sexual: Schema.optional(Schema.Struct({
    filtered: Schema.Boolean,
    severity: Schema.optional(Schema.Literal("safe", "low", "medium", "high"))
  })),
  violence: Schema.optional(Schema.Struct({
    filtered: Schema.Boolean,
    severity: Schema.optional(Schema.Literal("safe", "low", "medium", "high"))
  })),
  selfHarm: Schema.optional(Schema.Struct({
    filtered: Schema.Boolean,
    severity: Schema.optional(Schema.Literal("safe", "low", "medium", "high"))
  })),
})

class ContentFilteredError extends Schema.TaggedError<ContentFilteredError>()(
  "ContentFilteredError",
  {
    operation: AiOperation,
    provider: AiProvider,
    model: Schema.optional(Schema.String),
    requestId: Schema.optional(Schema.String),
    timestamp: Schema.Date,
    filterType: Schema.Literal("input", "output"),
    categories: Schema.optional(ContentFilterResult),
    providerDetails: Schema.optional(Schema.Unknown),
  }
) {
  readonly code = AiErrorCode.CONTENT_FILTERED
  readonly isRetryable = false
  
  get triggeredCategories(): string[] {
    if (!this.categories) return []
    return Object.entries(this.categories)
      .filter(([_, v]) => v?.filtered)
      .map(([k]) => k)
  }
  
  get suggestion(): string {
    const cats = this.triggeredCategories
    if (cats.length > 0) {
      return `Content filtered for: ${cats.join(", ")}. Review and modify the ${this.filterType}.`
    }
    return `Content filtered. Review and modify the ${this.filterType}.`
  }
}
```

### Tool Errors

```typescript
class ToolParameterError extends Schema.TaggedError<ToolParameterError>()(
  "ToolParameterError",
  {
    operation: Schema.Literal("toolCall"),
    provider: AiProvider,
    model: Schema.optional(Schema.String),
    timestamp: Schema.Date,
    toolName: Schema.String,
    toolCallId: Schema.String,
    parameters: Schema.Unknown,
    validationError: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
  readonly code = AiErrorCode.TOOL_PARAMETER_INVALID
  readonly isRetryable = false
  readonly isLLMRecoverable = true  // LLM can retry with corrected params
  
  get suggestion(): string {
    return "LLM provided invalid tool parameters. Return error to LLM for correction."
  }
}

class ToolExecutionError extends Schema.TaggedError<ToolExecutionError>()(
  "ToolExecutionError",
  {
    operation: Schema.Literal("toolExecution"),
    provider: AiProvider,
    model: Schema.optional(Schema.String),
    timestamp: Schema.Date,
    toolName: Schema.String,
    toolCallId: Schema.String,
    parameters: Schema.Unknown,
    executionError: Schema.Unknown,
    cause: Schema.optional(Schema.Unknown),
  }
) {
  readonly code = AiErrorCode.TOOL_EXECUTION_FAILED
  readonly isRetryable = false
  readonly isLLMRecoverable = false
  
  get suggestion(): string {
    return "Tool execution failed. Check tool implementation and input parameters."
  }
}
```

### Stream Interrupted

```typescript
class StreamInterruptedError extends Schema.TaggedError<StreamInterruptedError>()(
  "StreamInterruptedError",
  {
    operation: Schema.Literal("streamText", "streamObject"),
    provider: AiProvider,
    model: Schema.optional(Schema.String),
    requestId: Schema.optional(Schema.String),
    timestamp: Schema.Date,
    partialContent: Schema.optional(Schema.String),
    tokensGenerated: Schema.optional(Schema.Number),
    interruptReason: Schema.Literal("network", "timeout", "server_error", "client_abort", "unknown"),
    cause: Schema.optional(Schema.Unknown),
  }
) {
  readonly code = AiErrorCode.STREAM_INTERRUPTED
  readonly isRetryable = true
  
  get suggestion(): string {
    if (this.partialContent) {
      return "Stream interrupted but partial content received. Consider retrying or using partial result."
    }
    return "Stream interrupted. Retry the request."
  }
}
```

---

## Provider Error Mapping

### OpenAI

| HTTP Status | OpenAI Code | Maps To |
|-------------|------------|---------|
| 400 | invalid_request_error | `InvalidRequestError` |
| 400 | context_length_exceeded | `TokenLimitExceededError` |
| 401 | invalid_api_key | `AuthenticationError` |
| 403 | insufficient_permissions | `PermissionDeniedError` |
| 404 | model_not_found | `ModelNotFoundError` |
| 429 | rate_limit_exceeded | `RateLimitError` |
| 429 | insufficient_quota | `QuotaExceededError` ⚠️ |
| 500 | server_error | `ProviderError` |
| 503 | overloaded | `ModelOverloadedError` |

### Anthropic

| HTTP Status | Anthropic Type | Maps To |
|-------------|---------------|---------|
| 400 | invalid_request_error | `InvalidRequestError` |
| 401 | authentication_error | `AuthenticationError` |
| 403 | permission_error | `PermissionDeniedError` |
| 404 | not_found_error | `ModelNotFoundError` |
| 429 | rate_limit_error | `RateLimitError` |
| 500 | api_error | `ProviderError` |
| 529 | overloaded_error | `ModelOverloadedError` |

---

## Usage Examples

### Comprehensive Error Handling

```typescript
import { AiError, LanguageModel } from "effect/unstable/ai"

const program = LanguageModel.generateText({
  prompt: "Explain quantum computing"
}).pipe(
  Effect.catchTags({
    // Retryable errors with backoff
    RateLimitError: (e) =>
      Effect.delay(e.retryAfter ?? Duration.seconds(30)).pipe(
        Effect.andThen(Effect.retry(program))
      ),
    ModelOverloadedError: (e) =>
      Effect.delay(e.retryAfter).pipe(
        Effect.andThen(Effect.retry(program))
      ),
    
    // Non-retryable - escalate
    AuthenticationError: (e) =>
      Effect.logError("API key issue:", e).pipe(
        Effect.andThen(Effect.fail(e))
      ),
    QuotaExceededError: (e) =>
      Effect.logError("Billing quota exceeded - cannot retry:", e).pipe(
        Effect.andThen(Effect.fail(e))
      ),
    
    // Token limit - truncate and retry
    TokenLimitExceededError: (e) =>
      Effect.logWarning(`Reduce by ${e.overage} tokens`).pipe(
        Effect.andThen(truncateAndRetry(e))
      ),
    
    // Content safety
    ContentFilteredError: (e) =>
      Effect.succeed({ text: "Content unavailable due to safety filters." }),
  })
)
```

### Simple Retry for Retryable Errors

```typescript
const withRetry = program.pipe(
  Effect.retry({
    while: (e) => AiError.isAiError(e) && e.isRetryable,
    times: 3,
    schedule: Schedule.exponential("1 second")
  })
)
```

---

## Implementation Plan

### Phase 1: Core Error Types (Day 1-2)

**Tasks:**
1. Create new file structure under `packages/effect/src/unstable/ai/`
2. Implement shared schemas: `AiOperation`, `AiProvider`, `AiErrorCode`
3. Implement each error class using `Schema.TaggedError`
4. Create union type `AiError` and type guard `isAiError`
5. Implement utility functions (`isRetryable`, etc.)

**File Structure:**
```
packages/effect/src/unstable/ai/
├── AiError.ts              # Union type, guards, codes, re-exports
├── errors/
│   ├── index.ts            # Re-exports
│   ├── common.ts           # AiOperation, AiProvider, AiErrorCode schemas
│   ├── network.ts          # ConnectionError, TimeoutError
│   ├── auth.ts             # AuthenticationError, PermissionDeniedError
│   ├── ratelimit.ts        # RateLimitError, QuotaExceededError
│   ├── input.ts            # InvalidRequestError, TokenLimitExceededError
│   ├── content.ts          # ContentFilteredError, ContentPolicyViolationError
│   ├── model.ts            # ModelNotFoundError, ModelOverloadedError
│   ├── tool.ts             # ToolNotFoundError, ToolParameterError, etc.
│   ├── streaming.ts        # StreamInterruptedError
│   ├── response.ts         # MalformedResponseError, EmptyResponseError
│   ├── provider.ts         # ProviderError
│   └── unknown.ts          # UnknownError
```

**Validation after each file:**
- `pnpm lint --fix <file>`
- `pnpm tsc`

### Phase 2: Provider Error Mapping (Day 3)

**Tasks:**
1. Create `packages/effect/src/unstable/ai/errors/mapping.ts`
2. Implement `fromHttpClientError` utility
3. Implement OpenAI-specific error parsing (parse response body for `code` field)
4. Extract headers: `Retry-After`, `x-request-id`, rate limit headers
5. Preserve original error in `cause`

```typescript
// mapping.ts
export const fromHttpClientError = (params: {
  module: string
  method: string
  operation: AiOperation
  provider: AiProvider
  model?: string
  error: HttpClientError.HttpClientError
  responseBody?: unknown
}): AiError => { ... }
```

### Phase 3: SDK Integration (Day 4-5)

**Tasks:**
1. Update `Toolkit.ts`:
   - Replace `MalformedOutput` with `ToolNotFoundError`, `ToolParameterError`
   - Replace `MalformedInput` with `ToolResultEncodingError`
2. Update `LanguageModel.ts`:
   - Update error types in signatures
   - Use new errors in implementations
3. Update `Chat.ts`:
   - Propagate new error types
4. **Fix `OpenAiClient.ts`**:
   - Uncomment HTTP error mapping (lines 100-112)
   - Use `fromHttpClientError` mapping

### Phase 4: Testing (Day 6-7)

**Tasks:**
1. Create `packages/effect/test/unstable/ai/AiError.test.ts`
2. Test each error type construction
3. Test `catchTag`/`catchTags` pattern matching
4. Test provider error mapping
5. Test serialization round-trip
6. Test computed properties (`overage`, `triggeredCategories`, etc.)

### Phase 5: Documentation & Cleanup (Day 8)

**Tasks:**
1. Add JSDoc to all error classes with examples
2. Document error codes
3. Run `pnpm docgen`
4. Remove old error types
5. Update any remaining usages

---

## Files Affected

| File | Change Type |
|------|-------------|
| `packages/effect/src/unstable/ai/AiError.ts` | Complete rewrite |
| `packages/effect/src/unstable/ai/errors/*.ts` | New files |
| `packages/effect/src/unstable/ai/LanguageModel.ts` | Error type updates |
| `packages/effect/src/unstable/ai/Toolkit.ts` | Tool error updates |
| `packages/effect/src/unstable/ai/Chat.ts` | Error propagation |
| `packages/ai/openai/src/OpenAiClient.ts` | Enable HTTP error mapping |
| `packages/effect/test/unstable/ai/AiError.test.ts` | New test file |

---

## Validation Checklist

Before each commit:
- [ ] `pnpm lint --fix <files>`
- [ ] `pnpm tsc`
- [ ] `pnpm docgen`
- [ ] `pnpm test packages/effect/test/unstable/ai/`
