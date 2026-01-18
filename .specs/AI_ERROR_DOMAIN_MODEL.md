# AI Error Domain Model

**Status: DRAFT**

## Overview

Replace the current `AiError` design with a comprehensive, provider-agnostic domain model for errors originating from large language model providers. The new design uses the `reason` pattern (see `Effect.catchReason`) where `AiError` is a top-level wrapper error containing `module`, `method`, and a `reason` field that holds the semantic error.

## Problem Statement / Motivation

### Current Limitations

1. **Transport-centric errors**: Current errors (`HttpRequestError`, `HttpResponseError`) focus on HTTP mechanics, not AI-specific failure modes
2. **Missing semantic categories**: No distinction between rate limiting, quota exhaustion, content policy violations, model availability, etc.
3. **Poor retry guidance**: Errors don't indicate whether retrying is appropriate or provide backoff hints
4. **Limited provider context**: No structured way to capture provider-specific error codes or metadata
5. **No cost/usage context**: Errors don't capture token usage or cost information when available
6. **Weak recoverability signals**: Callers can't easily determine if an error is transient vs permanent
7. **Bad naming**: `MalformedInput` is unclear and doesn't convey semantic meaning

### Goals

- **Semantic error categories** that map to LLM-specific failure modes
- **Provider-agnostic** design that works across OpenAI, Anthropic, Google, etc.
- **Rich context** including retry hints, provider error codes, usage data
- **Recoverability classification** (transient vs permanent)
- **Actionable error messages** with specific remediation guidance
- **Leverage `reason` pattern** for ergonomic error handling via `Effect.catchReason`

## Design Decisions

### 1. Schema.ErrorClass with `_tag` via Schema.tag

All errors use `Schema.ErrorClass` with `_tag` defined via `Schema.tag("...")`:

```typescript
export class RateLimitError extends Schema.ErrorClass<RateLimitError>(
  "effect/ai/AiError/RateLimitError"
)({
  _tag: Schema.tag("RateLimitError")
  // ... fields
}) {}
```

### 2. `reason` Pattern with Top-Level AiError

Use the `reason` pattern recently introduced in Effect (see `Effect.catchReason`, `Effect.unwrapReason`). `AiError` is the top-level error with `module`, `method`, and `reason`:

```typescript
class AiError extends Schema.ErrorClass<AiError>("effect/ai/AiError")({
  _tag: Schema.tag("AiError"),
  module: Schema.String,
  method: Schema.String,
  reason: AiErrorReason // Union of all semantic error types
}) {}
```

This enables:

```typescript
// Handle specific reason types
program.pipe(
  Effect.catchReason("AiError", "RateLimitError", (reason) => Effect.succeed(`Retry after ${reason.retryAfter}`))
)

// Handle multiple reasons
program.pipe(
  Effect.catchReasons("AiError", {
    RateLimitError: (r) => Effect.succeed(`Retry after ${r.retryAfter}`),
    QuotaExhaustedError: (r) => Effect.fail(new BillingError())
  })
)

// Unwrap reason to error channel
program.pipe(Effect.unwrapReason("AiError"))
// Effect<A, AiError> -> Effect<A, RateLimitError | QuotaExhaustedError | ...>
```

### 3. Provider-Specific Mapping in Provider Packages

Provider-specific error mapping (e.g., OpenAI error codes -> semantic reasons) lives in provider packages, not in the core `AiError` module. The core module provides:

- Semantic reason types
- Base `AiError` wrapper
- Generic HTTP -> reason mapping utilities

Provider packages implement:

- Provider-specific error code mapping
- Custom reason construction from provider responses

### 4. Semantic Error Categories

Map provider errors to semantic categories:

- `RateLimitError` - Request throttled (429s, provider-specific limits)
- `QuotaExhaustedError` - Account/billing limits reached
- `AuthenticationError` - Invalid/expired credentials
- `ContentPolicyError` - Input/output violated content policy
- `ModelUnavailableError` - Model not available/deprecated
- `ContextLengthError` - Token limit exceeded
- `InvalidRequestError` - Malformed request parameters (replaces `MalformedInput`)
- `ProviderInternalError` - Provider-side failures (5xx)
- `TimeoutError` - Request timeout (no streaming-specific types)
- `NetworkError` - Transport-level failures
- `OutputParseError` - LLM output parsing failures
- `UnknownError` - Catch-all

### 5. Recoverability Classification

Each reason has an `isRetryable` getter that computes retryability based on the error state:

```typescript
get isRetryable(): boolean {
  return true  // or computed based on error properties
}
readonly retryAfter?: Duration  // Effect Duration type, when retry is recommended
```

This approach:

- Avoids redundant stored state
- Allows retryability to be computed from other fields (e.g., `ModelUnavailableError` is retryable only if `kind` is `"Overloaded"` or `"Maintenance"`)
- Keeps the schema simpler (no need for `Schema.Literal(true).withDefault()`)

### 6. ContentPolicyError Includes Flagged Content

When available, include the flagged content for debugging:

```typescript
flaggedContent: Schema.optional(Schema.String) // The actual content that was flagged
```

### 7. No Streaming-Specific Error Types

Streaming errors map to existing reason types:

- Stream timeout -> `TimeoutError`
- Stream interrupted -> `NetworkError`
- Partial response -> `OutputParseError` or `ProviderInternalError`

## Technical Details

### Top-Level AiError

```typescript
const TypeId = "~effect/unstable/ai/AiError" as const

export class AiError extends Schema.ErrorClass<AiError>("effect/ai/AiError")({
  _tag: Schema.tag("AiError"),
  module: Schema.String,
  method: Schema.String,
  reason: AiErrorReason
}) {
  readonly [TypeId] = TypeId

  /**
   * Delegates to the underlying reason's isRetryable getter.
   */
  get isRetryable(): boolean {
    return this.reason.isRetryable
  }

  /**
   * Delegates to the underlying reason's retryAfter if present.
   */
  get retryAfter(): Duration | undefined {
    return "retryAfter" in this.reason ? this.reason.retryAfter : undefined
  }

  override get message(): string {
    return `${this.module}.${this.method}: ${this.reason.message}`
  }
}

export const isAiError = (u: unknown): u is AiError => Predicate.hasProperty(u, TypeId)
```

### Reason Type Definitions

#### RateLimitError

```typescript
export class RateLimitError extends Schema.ErrorClass<RateLimitError>(
  "effect/ai/AiError/RateLimitError"
)({
  _tag: Schema.tag("RateLimitError"),
  retryAfter: Schema.optional(Schema.Duration),
  limit: Schema.optional(Schema.String), // "requests" | "tokens" | etc.
  remaining: Schema.optional(Schema.Number),
  resetAt: Schema.optional(Schema.DateTimeUtc),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return true
  }

  override get message(): string {
    let msg = `Rate limit exceeded`
    if (this.limit) msg += ` (${this.limit})`
    if (this.retryAfter) msg += `. Retry after ${Duration.format(this.retryAfter)}`
    return msg
  }
}
```

#### QuotaExhaustedError

```typescript
export class QuotaExhaustedError extends Schema.ErrorClass<QuotaExhaustedError>(
  "effect/ai/AiError/QuotaExhaustedError"
)({
  _tag: Schema.tag("QuotaExhaustedError"),
  quotaType: Schema.optional(Schema.String), // "tokens" | "requests" | "spend"
  resetAt: Schema.optional(Schema.DateTimeUtc),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    let msg = `Quota exhausted`
    if (this.quotaType) msg += ` (${this.quotaType})`
    if (this.resetAt) msg += `. Resets at ${this.resetAt}`
    return `${msg}. Check your account billing and usage limits.`
  }
}
```

#### AuthenticationError

```typescript
export class AuthenticationError extends Schema.ErrorClass<AuthenticationError>(
  "effect/ai/AiError/AuthenticationError"
)({
  _tag: Schema.tag("AuthenticationError"),
  kind: Schema.Literals(["InvalidKey", "ExpiredKey", "MissingKey", "InsufficientPermissions", "Unknown"]),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    const suggestions: Record<string, string> = {
      InvalidKey: "Verify your API key is correct",
      ExpiredKey: "Your API key has expired. Generate a new one",
      MissingKey: "No API key provided. Set the appropriate environment variable",
      InsufficientPermissions: "Your API key lacks required permissions",
      Unknown: "Authentication failed. Check your credentials"
    }
    return `${this.kind}: ${suggestions[this.kind]}`
  }
}
```

#### ContentPolicyError

```typescript
export class ContentPolicyError extends Schema.ErrorClass<ContentPolicyError>(
  "effect/ai/AiError/ContentPolicyError"
)({
  _tag: Schema.tag("ContentPolicyError"),
  violationType: Schema.optional(Schema.String), // "hate" | "violence" | etc.
  flaggedInput: Schema.optional(Schema.Boolean), // true if input was flagged
  flaggedOutput: Schema.optional(Schema.Boolean), // true if output was flagged
  flaggedContent: Schema.optional(Schema.String), // actual content that was flagged
  categories: Schema.optional(Schema.Array(Schema.String)),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    let msg = `Content policy violation`
    if (this.violationType) msg += `: ${this.violationType}`
    if (this.flaggedInput) msg += ` in input`
    if (this.flaggedOutput) msg += ` in output`
    return msg
  }
}
```

#### ModelUnavailableError

```typescript
export class ModelUnavailableError extends Schema.ErrorClass<ModelUnavailableError>(
  "effect/ai/AiError/ModelUnavailableError"
)({
  _tag: Schema.tag("ModelUnavailableError"),
  model: Schema.String,
  kind: Schema.Literals(["NotFound", "Deprecated", "Overloaded", "Maintenance", "Unknown"]),
  alternativeModels: Schema.optional(Schema.Array(Schema.String)),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    // Retryable only for temporary conditions
    return this.kind === "Overloaded" || this.kind === "Maintenance"
  }

  override get message(): string {
    let msg = `Model '${this.model}' unavailable: ${this.kind}`
    if (this.alternativeModels && this.alternativeModels.length > 0) {
      msg += `. Try: ${this.alternativeModels.join(", ")}`
    }
    return msg
  }
}
```

#### ContextLengthError

```typescript
export class ContextLengthError extends Schema.ErrorClass<ContextLengthError>(
  "effect/ai/AiError/ContextLengthError"
)({
  _tag: Schema.tag("ContextLengthError"),
  maxTokens: Schema.optional(Schema.Number),
  requestedTokens: Schema.optional(Schema.Number),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return false // Requires reducing input, not just retrying
  }

  override get message(): string {
    let msg = `Context length exceeded`
    if (this.requestedTokens && this.maxTokens) {
      msg += `: requested ${this.requestedTokens} tokens, max ${this.maxTokens}`
    }
    return `${msg}. Reduce input size or use a model with larger context window.`
  }
}
```

#### InvalidRequestError

Replaces `MalformedInput` with clearer naming.

```typescript
export class InvalidRequestError extends Schema.ErrorClass<InvalidRequestError>(
  "effect/ai/AiError/InvalidRequestError"
)({
  _tag: Schema.tag("InvalidRequestError"),
  parameter: Schema.optional(Schema.String),
  constraint: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return false // Invalid requests need to be fixed, not retried
  }

  override get message(): string {
    let msg = `Invalid request`
    if (this.parameter) msg += `: parameter '${this.parameter}'`
    if (this.constraint) msg += ` ${this.constraint}`
    if (this.description) msg += `. ${this.description}`
    return msg
  }
}
```

#### ProviderInternalError

```typescript
export class ProviderInternalError extends Schema.ErrorClass<ProviderInternalError>(
  "effect/ai/AiError/ProviderInternalError"
)({
  _tag: Schema.tag("ProviderInternalError"),
  retryAfter: Schema.optional(Schema.Duration),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return true // Provider errors are typically transient
  }

  override get message(): string {
    let msg = `Provider internal error`
    if (this.provider?.name) msg = `${this.provider.name} internal error`
    if (this.retryAfter) msg += `. Retry after ${Duration.format(this.retryAfter)}`
    return `${msg}. This is likely temporary.`
  }
}
```

#### TimeoutError

```typescript
export class TimeoutError extends Schema.ErrorClass<TimeoutError>(
  "effect/ai/AiError/TimeoutError"
)({
  _tag: Schema.tag("TimeoutError"),
  phase: Schema.Literals(["Connection", "Request", "Response"]),
  duration: Schema.optional(Schema.Duration),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return true // Timeouts are typically transient
  }

  override get message(): string {
    let msg = `${this.phase} timeout`
    if (this.duration) msg += ` after ${Duration.format(this.duration)}`
    return msg
  }
}
```

#### NetworkError

```typescript
export class NetworkError extends Schema.ErrorClass<NetworkError>(
  "effect/ai/AiError/NetworkError"
)({
  _tag: Schema.tag("NetworkError"),
  kind: Schema.Literals(["ConnectionRefused", "DnsLookupFailed", "TlsError", "Unknown"]),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return true // Network errors are typically transient
  }

  override get message(): string {
    const suggestions: Record<string, string> = {
      ConnectionRefused: "Check network connectivity and firewall settings",
      DnsLookupFailed: "Verify the API endpoint hostname is correct",
      TlsError: "TLS/SSL handshake failed. Check certificate validity",
      Unknown: "Network error occurred. Check your connection"
    }
    return `${this.kind}: ${suggestions[this.kind]}`
  }
}
```

#### OutputParseError

```typescript
export class OutputParseError extends Schema.ErrorClass<OutputParseError>(
  "effect/ai/AiError/OutputParseError"
)({
  _tag: Schema.tag("OutputParseError"),
  rawOutput: Schema.optional(Schema.String),
  expectedSchema: Schema.optional(Schema.String),
  provider: Schema.optional(ProviderMetadata),
  usage: Schema.optional(UsageInfo),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return true // LLM outputs are non-deterministic, retry often works
  }

  static fromSchemaError(params: {
    readonly rawOutput?: string
    readonly error: Schema.SchemaError
  }): OutputParseError {
    return new OutputParseError({
      rawOutput: params.rawOutput,
      cause: params.error
    })
  }

  override get message(): string {
    return `Failed to parse LLM output into expected schema`
  }
}
```

#### UnknownError

```typescript
export class UnknownError extends Schema.ErrorClass<UnknownError>(
  "effect/ai/AiError/UnknownError"
)({
  _tag: Schema.tag("UnknownError"),
  description: Schema.optional(Schema.String),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  get isRetryable(): boolean {
    return false // Unknown errors are not safe to retry by default
  }

  override get message(): string {
    return this.description ?? `Unknown error`
  }
}
```

### Supporting Schemas

```typescript
export const ProviderMetadata = Schema.Struct({
  name: Schema.String,
  errorCode: Schema.optional(Schema.String),
  errorType: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  raw: Schema.optional(Schema.Unknown)
}).annotate({ identifier: "ProviderMetadata" })

export const HttpRequestDetails = Schema.Struct({
  method: Schema.Literals(["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"]),
  url: Schema.String,
  urlParams: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  hash: Schema.optional(Schema.String),
  headers: Schema.Record(Schema.String, Schema.String)
}).annotate({ identifier: "HttpRequestDetails" })

export const HttpResponseDetails = Schema.Struct({
  status: Schema.Number,
  headers: Schema.Record(Schema.String, Schema.String)
}).annotate({ identifier: "HttpResponseDetails" })

export const HttpContext = Schema.Struct({
  request: HttpRequestDetails,
  response: Schema.optional(HttpResponseDetails),
  body: Schema.optional(Schema.String)
}).annotate({ identifier: "HttpContext" })

export const UsageInfo = Schema.Struct({
  promptTokens: Schema.optional(Schema.Number),
  completionTokens: Schema.optional(Schema.Number),
  totalTokens: Schema.optional(Schema.Number)
}).annotate({ identifier: "UsageInfo" })
```

### Reason Union Type

```typescript
export type AiErrorReason =
  | RateLimitError
  | QuotaExhaustedError
  | AuthenticationError
  | ContentPolicyError
  | ModelUnavailableError
  | ContextLengthError
  | InvalidRequestError
  | ProviderInternalError
  | TimeoutError
  | NetworkError
  | OutputParseError
  | UnknownError

export const AiErrorReason: Schema.Union<[
  typeof RateLimitError,
  typeof QuotaExhaustedError,
  typeof AuthenticationError,
  typeof ContentPolicyError,
  typeof ModelUnavailableError,
  typeof ContextLengthError,
  typeof InvalidRequestError,
  typeof ProviderInternalError,
  typeof TimeoutError,
  typeof NetworkError,
  typeof OutputParseError,
  typeof UnknownError
]> = Schema.Union([
  RateLimitError,
  QuotaExhaustedError,
  AuthenticationError,
  ContentPolicyError,
  ModelUnavailableError,
  ContextLengthError,
  InvalidRequestError,
  ProviderInternalError,
  TimeoutError,
  NetworkError,
  OutputParseError,
  UnknownError
])
```

### Utility Functions (Core Module)

```typescript
/**
 * Creates an AiError with the given reason.
 */
export const make = (params: {
  readonly module: string
  readonly method: string
  readonly reason: AiErrorReason
}): AiError => new AiError(params)

/**
 * Base HTTP status code to reason mapping.
 * Provider packages can extend this for provider-specific codes.
 */
export const reasonFromHttpStatus = (params: {
  readonly status: number
  readonly body?: unknown
  readonly http?: typeof HttpContext.Type
  readonly provider?: typeof ProviderMetadata.Type
}): AiErrorReason => {
  const { status, body, http, provider } = params
  switch (status) {
    case 400:
      return new InvalidRequestError({ http, provider, cause: body })
    case 401:
      return new AuthenticationError({ kind: "InvalidKey", http, provider, cause: body })
    case 403:
      return new AuthenticationError({ kind: "InsufficientPermissions", http, provider, cause: body })
    case 408:
      return new TimeoutError({ phase: "Request", http, provider, cause: body })
    case 429:
      return new RateLimitError({ http, provider, cause: body })
    default:
      if (status >= 500) {
        return new ProviderInternalError({ http, provider, cause: body })
      }
      return new UnknownError({ http, provider, cause: body })
  }
}
```

## Implementation Phases

### Phase 1: Supporting Schemas

**Goal**: Define foundational schemas for metadata and context.

**Files to modify**:

- `packages/effect/src/unstable/ai/AiError.ts`

**Tasks**:

- [x] **1.1** Add `ProviderMetadata` schema with `name`, `errorCode`, `errorType`, `requestId`, `raw` fields
- [x] **1.2** Add `UsageInfo` schema with token count fields
- [x] **1.3** Keep existing `HttpRequestDetails` schema (already well-defined)
- [x] **1.4** Keep existing `HttpResponseDetails` schema
- [x] **1.5** Add `HttpContext` schema combining request/response/body
- [x] **1.6** Run `pnpm lint-fix`
- [x] **1.7** Run `pnpm check`

**Verification**: `pnpm check` passes

### Phase 2: Reason Classes (Part 1)

**Goal**: Implement first batch of semantic reason types.

**Files to modify**:

- `packages/effect/src/unstable/ai/AiError.ts`

**Tasks**:

- [x] **2.1** Create `RateLimitError` with `isRetryable` getter (returns `true`), `retryAfter: Duration`, `limit`, `remaining`, `resetAt`
- [x] **2.2** Create `QuotaExhaustedError` with `isRetryable` getter (returns `false`), `quotaType`, `resetAt`
- [x] **2.3** Create `AuthenticationError` with `isRetryable` getter (returns `false`), `kind` discriminant
- [x] **2.4** Create `ContentPolicyError` with `isRetryable` getter (returns `false`), `violationType`, `flaggedInput`, `flaggedOutput`, `flaggedContent`, `categories`
- [x] **2.5** Create `ModelUnavailableError` with `isRetryable` getter (computed from `kind`), `model`, `kind`, `alternativeModels`
- [x] **2.6** Create `ContextLengthError` with `isRetryable` getter (returns `false`), `maxTokens`, `requestedTokens`
- [x] **2.7** Run `pnpm lint-fix`
- [x] **2.8** Run `pnpm check`

**Verification**: `pnpm check` passes

### Phase 3: Reason Classes (Part 2)

**Goal**: Implement remaining reason types.

**Files to modify**:

- `packages/effect/src/unstable/ai/AiError.ts`

**Tasks**:

- [x] **3.1** Create `InvalidRequestError` with `isRetryable` getter (returns `false`), `parameter`, `constraint`, `description`
- [x] **3.2** Create `ProviderInternalError` with `isRetryable` getter (returns `true`), `retryAfter: Duration`
- [x] **3.3** Create `AiTimeoutError` with `isRetryable` getter (returns `true`), `phase` discriminant, `duration: Duration`
- [x] **3.4** Create `NetworkError` with `isRetryable` getter (returns `true`), `kind` discriminant
- [x] **3.5** Create `OutputParseError` with `isRetryable` getter (returns `true`), `rawOutput`, `expectedSchema`, `fromSchemaError` static method
- [x] **3.6** Create `AiUnknownError` with `isRetryable` getter (returns `false`), `description`
- [x] **3.7** Run `pnpm lint-fix`
- [x] **3.8** Run `pnpm check`

**Verification**: `pnpm check` passes

### Phase 4: AiErrorReason Union & Top-Level AiError

**Goal**: Create reason union and top-level AiError wrapper.

**Files to modify**:

- `packages/effect/src/unstable/ai/AiError.ts`

**Tasks**:

- [x] **4.1** Create `AiErrorReason` type union of all reason types
- [x] **4.2** Create `AiErrorReason` schema union
- [x] **4.3** Create top-level `AiErrorWithReason` class with `module`, `method`, `reason: AiErrorReason`, `isRetryable` getter, `retryAfter` getter
- [x] **4.4** Implement `makeWithReason` constructor function
- [x] **4.5** Implement `reasonFromHttpStatus` utility function
- [x] **4.6** Add `isAiErrorWithReason` type guard
- [x] **4.7** Run `pnpm lint-fix`
- [x] **4.8** Run `pnpm check`

**Verification**: `pnpm check` passes

### Phase 5: Remove Deprecated Types & Update Consumers

**Goal**: Remove old error types and update consumers to use new design.

**Files to modify**:

- `packages/effect/src/unstable/ai/AiError.ts`
- `packages/effect/src/unstable/ai/LanguageModel.ts`
- `packages/effect/src/unstable/ai/Toolkit.ts`

**Tasks**:

- [ ] **5.1** Remove `HttpRequestError` class
- [ ] **5.2** Remove `HttpResponseError` class
- [ ] **5.3** Remove `MalformedInput` class (replaced by `InvalidRequestError`)
- [ ] **5.4** Remove `MalformedOutput` class (replaced by `OutputParseError`)
- [ ] **5.5** Remove old `UnknownError` class
- [ ] **5.6** Update `LanguageModel.ts` to use new `AiError` with `reason`
- [ ] **5.7** Update `Toolkit.ts` to use new `AiError` with `reason`
- [ ] **5.8** Update `isAiError` checks throughout codebase
- [ ] **5.9** Run `pnpm lint-fix`
- [ ] **5.10** Run `pnpm check`

**Verification**: `pnpm check` passes

### Phase 6: Tests

**Goal**: Comprehensive test coverage for all error types.

**Files to create/modify**:

- `packages/effect/test/unstable/ai/AiError.test.ts`

**Tasks**:

- [ ] **6.1** Test `AiError` construction with each reason type
- [ ] **6.2** Test message generation for `AiError` and each reason
- [ ] **6.3** Test `isRetryable` getter returns correct value for each reason type
- [ ] **6.4** Test `AiError.isRetryable` delegates to reason's `isRetryable`
- [ ] **6.5** Test `AiError.retryAfter` delegates to reason's `retryAfter` when present
- [ ] **6.6** Test `Effect.catchReason("AiError", "<reason>", ...)` for all reasons
- [ ] **6.7** Test `Effect.catchReasons("AiError", {...})` with multiple handlers
- [ ] **6.8** Test `Effect.unwrapReason("AiError")` promotes reason to error channel
- [ ] **6.9** Test `reasonFromHttpStatus` mapping
- [ ] **6.10** Test `OutputParseError.fromSchemaError` static method
- [ ] **6.11** Test `isAiError` type guard
- [ ] **6.12** Test schema encoding/decoding roundtrip for all types
- [ ] **6.13** Run `pnpm test AiError`

**Verification**: All tests pass

### Phase 7: Documentation & JSDoc

**Goal**: Comprehensive documentation with examples.

**Files to modify**:

- `packages/effect/src/unstable/ai/AiError.ts`

**Tasks**:

- [ ] **7.1** Add module-level JSDoc with overview, `reason` pattern usage, and examples
- [ ] **7.2** Add JSDoc to `AiError` class with `@example` showing `catchReason` usage
- [ ] **7.3** Add JSDoc to each reason class with `@example`, `@since`, `@category`
- [ ] **7.4** Add JSDoc to supporting schemas
- [ ] **7.5** Add JSDoc to utility functions
- [ ] **7.6** Run `pnpm docgen` to verify examples compile
- [ ] **7.7** Run `pnpm lint-fix`

**Verification**: `pnpm docgen` passes

## Testing Requirements

### Unit Tests

- Construction of `AiError` with each reason type
- `isRetryable` getter returns correct value for each reason type
- `AiError.isRetryable` delegates to reason
- `AiError.retryAfter` delegates to reason when present
- Message generation for `AiError` (delegates to reason)
- Message generation for each reason type
- Type guard `isAiError`

### Integration Tests

- `reasonFromHttpStatus` mapping for:
  - 400 -> `InvalidRequestError`
  - 401 -> `AuthenticationError` (InvalidKey)
  - 403 -> `AuthenticationError` (InsufficientPermissions)
  - 408 -> `TimeoutError`
  - 429 -> `RateLimitError`
  - 5xx -> `ProviderInternalError`
- Schema round-trip encoding/decoding for all types

### Error Handling Pattern Tests

- `Effect.catchReason("AiError", "RateLimitError", handler)` works
- `Effect.catchReasons("AiError", { ... })` handles multiple reasons
- `Effect.unwrapReason("AiError")` extracts reason to error channel
- Effect error channel typing is correct with `reason` pattern

## Verification Checklist

- [ ] `pnpm lint-fix` passes
- [ ] `pnpm check` passes
- [ ] `pnpm test AiError` passes
- [ ] `pnpm docgen` passes
- [ ] All errors use `Schema.ErrorClass` with `_tag` via `Schema.tag`
- [ ] `AiError` has `module`, `method`, `reason` fields
- [ ] `reason` field is union of all reason types
- [ ] `Effect.catchReason` / `Effect.catchReasons` / `Effect.unwrapReason` work correctly
- [ ] `retryAfter` uses `Schema.Duration`
- [ ] `ContentPolicyError` includes `flaggedContent` field
- [ ] No streaming-specific error types (use `TimeoutError`, `NetworkError`, etc.)
- [ ] `MalformedInput` replaced by `InvalidRequestError`
- [ ] Provider-specific mapping documented as responsibility of provider packages
- [ ] All reason types have `isRetryable` getter
- [ ] `AiError` has `isRetryable` and `retryAfter` getters that delegate to reason
- [ ] All reason types have JSDoc with examples
