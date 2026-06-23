# Adaptive Retry-After Rate Limiting

## Goal

Teach `HttpClient.withRateLimiter` to adapt to `429 Retry-After` responses in a distributed way.

The client should use the configured limiter before any server signal is observed. After a `429 Retry-After`, clients sharing the same `RateLimiterStore` should coordinate cooldown and learning so the fleet can converge on a safer `{ limit, window }` combination for that key.

## Current Behavior

`HttpClient.withRateLimiter` keeps local per-key state for `limit` and `window`.

Response inspection updates that local state from `RateLimit-*` headers.

The current branch changes `Retry-After` handling so it only extends the local window when it is longer than the current window, and explicit rate-limit reset headers are preferred over `Retry-After`.

The existing `429` retry path separately parses `Retry-After`, sleeps for that duration, and retries through the limiter.

## Problem

`Retry-After` alone does not reveal the server's true rate-limit policy.

If observation starts in the middle of a server window, the first `429 Retry-After` only tells us about the remaining part of that window. It should not be used to infer the ideal `{ limit, window }`.

The learning process should therefore begin only after the first `429 Retry-After`, once the cooldown has completed and a fresh observation period can start.

## Design

Keep `RateLimit-*` header handling separate from `Retry-After` learning.

`RateLimit-*` headers remain authoritative for the normal limiter state.

`429 Retry-After` drives a separate adaptive distributed layer backed by `RateLimiterStore`.

Do not permanently mutate the configured/main limiter window based only on `Retry-After`.

## State Machine

Use one compact adaptive state record per resolved rate-limit key.

```ts
type AdaptivePhase = "inactive" | "cooldown" | "learning" | "learned"

interface AdaptiveState {
  readonly phase: AdaptivePhase
  readonly epoch: number
  readonly cooldownUntil: number
  readonly learningStartedAt: number
  readonly observedTokens: number
  readonly learnedLimit: number
  readonly learnedWindowMillis: number
}
```

State transitions:

```txt
inactive
  429 Retry-After -> cooldown

cooldown
  first admitted request after cooldown -> learning

learning
  429 Retry-After -> learned

learned
  future 429 Retry-After -> recalibrate or re-enter cooldown/learning
```

The first `429 Retry-After` starts a distributed cooldown only. It must not infer a learned limit/window.

Learning starts on the first admitted request after cooldown, not exactly when the cooldown timestamp expires.

## Store API

Extend `RateLimiterStore` with an adaptive operation instead of adding request history or overloading `fixedWindow` / `tokenBucket`.

The exact names can change, but the store needs two capabilities.

```ts
readonly adaptiveConsume: (options: {
  readonly key: string
  readonly tokens: number
  readonly fallbackLimit: number
  readonly fallbackWindow: Duration.Duration
}) => Effect.Effect<AdaptiveConsumeResult, RateLimiterError>

readonly adaptiveFeedback: (options: {
  readonly key: string
  readonly epoch: number
  readonly tokens: number
  readonly status: number
  readonly retryAfter: Duration.Duration | undefined
}) => Effect.Effect<void, RateLimiterError>
```

`adaptiveConsume` should return enough metadata for response feedback to be correlated safely.

```ts
interface AdaptiveConsumeResult {
  readonly delay: Duration.Duration
  readonly epoch: number
  readonly phase: AdaptivePhase
}
```

If there is no adaptive state for the key, `adaptiveConsume` should return zero delay with an inactive phase.

If the key is in cooldown, `adaptiveConsume` should delay until `cooldownUntil`.

If cooldown has expired, the first consume should atomically transition the key to learning and initialize `learningStartedAt` and `observedTokens`.

If the key is learning, `adaptiveConsume` should atomically add the current request tokens to `observedTokens` and return zero delay.

If the key is learned, `adaptiveConsume` should apply the learned `{ limit, window }` using distributed pacing and return any required delay.

`adaptiveFeedback` should ignore responses that are not `429 Retry-After`.

`adaptiveFeedback` should ignore stale feedback when the epoch does not match the state it is trying to update.

## Learning Rule

When feedback receives a `429 Retry-After` while the key is in learning:

```ts
acceptedTokens = observedTokens - rejectedRequestTokens
learnedWindowMillis = now - learningStartedAt + retryAfterMillis
learnedLimit = acceptedTokens
```

If `acceptedTokens <= 0`, do not create a learned limiter. Store cooldown only and start a new learning period after the cooldown.

Count tokens, not requests, because `withRateLimiter` supports configurable `tokens`.

Use the request's consumed epoch so late responses from older phases cannot corrupt the current learned state.

## Integration With HttpClient.withRateLimiter

Before sending a request:

```txt
1. Resolve key and tokens.
2. Consume from the existing configured/header-derived limiter.
3. Consume from the adaptive retry-after layer; inactive keys should take the cheap zero-delay path.
4. Delay by the required limiter delay.
5. Send the request.
```

On response or `HttpClientError` response failure:

```txt
1. Continue updating normal local limiter state from explicit RateLimit-* headers.
2. If response is 429 and has Retry-After, send adaptive feedback to the store.
3. Continue sleeping for Retry-After before retrying through the limiter, as the current 429 retry path does.
```

`disableResponseInspection` should disable adaptive feedback and adaptive response learning.

The adaptive behavior should be per resolved `key`, not global.

## Redis Implementation

Implement adaptive store operations with Redis Lua scripts so consume and feedback transitions are atomic.

Use Redis server time inside Lua where possible instead of client wall-clock time to avoid clock skew between distributed clients.

Store one compact record per rate-limit key. Do not store request logs, sorted sets, or per-request entries.

Use TTLs aggressively. The adaptive state should expire after the relevant cooldown or learned window plus a small grace period.

Keep each Lua script O(1). No scans, no list traversal, and no key fan-out.

Use an epoch/version field to protect against concurrent and stale feedback.

## Memory Store Implementation

Mirror the Redis semantics in `layerStoreMemory` using an in-memory map.

Use `Clock` for time so tests can use `TestClock`.

Memory and Redis stores should expose the same phase, epoch, delay, and feedback behavior.

## Concurrency Rules

Multiple clients may hit the first `429` at about the same time.

Only the first valid `429 Retry-After` should transition `inactive -> cooldown`; later in-flight 429s should at most extend cooldown.

429s from requests admitted before cooldown or under an old epoch must not create a learned limiter.

In-flight requests admitted before a cooldown may still fail. Treat those as stale unless they can safely extend the cooldown.

When cooldown expires, a thundering herd is possible. The first admitted post-cooldown request should transition to learning atomically, and learned pacing should apply as soon as a learned state exists.

## Scaling Constraints

Adaptive state is acceptable if it remains one compact record per key.

High-cardinality keys require TTLs so inactive state disappears.

Hot keys will serialize through Redis, which is already true for distributed rate limiting.

Avoid adding an extra Redis round trip for every request when no adaptive state exists. Prefer a cheap inactive path or merge adaptive consume with the normal limiter consume if the API evolves that way.

Feedback is cheap because `429` should be rare. The per-request cost after a key enters cooldown, learning, or learned mode is the main scaling concern.

## Safety Bounds

Clamp malformed, zero, or past `Retry-After` values the same way existing parsing does today.

Consider a maximum adaptive cooldown/window to avoid one bad header poisoning a key for too long.

Consider a minimum learned limit of one token when a learned limiter is created.

Do not create a learned limiter when the inferred accepted token count is zero or negative.

Expire learned state so server policy changes are eventually revalidated.

## Tests

Add unit tests for the memory store adaptive state machine.

Add tests that the first `429 Retry-After` starts cooldown but does not infer a learned limit/window.

Add tests that learning starts on the first admitted request after cooldown.

Add tests that the next learning-phase `429 Retry-After` infers `acceptedTokens` and `learnedWindow` correctly.

Add tests that rejected request tokens are subtracted from observed tokens.

Add tests that stale epoch feedback is ignored.

Add tests that concurrent or repeated 429 feedback does not corrupt the learned state.

Add `HttpClient.withRateLimiter` tests for distributed behavior using a shared store.

Add tests that explicit `RateLimit-*` headers remain authoritative over adaptive `Retry-After` learning.

Add tests that `disableResponseInspection` disables adaptive feedback.

Add Redis script tests if this repository has existing Redis-backed test coverage available for `RateLimiterStore`.

## Plan

1. First update the types and interfaces to support the new `adaptiveConsume` and `adaptiveFeedback` operations.
2. Add stubs for the new operations to `RateLimiterStore` - no real implementation yet.
3. Add failing tests for the new operations and check if the design is sound.
   Make adjustments to this spec if changes are needed.
4. Implement the new operations in `layerStoreMemory` and `layerStoreRedis` to
   make the tests pass.

## Validation

Run targeted rate limiter and HTTP client tests.

```sh
pnpm test packages/effect/test/unstable/persistence/RateLimiter.test.ts
pnpm test packages/effect/test/unstable/http/HttpClient.test.ts
```

Run type checking after changing exported store interfaces.

```sh
pnpm check:tsgo
```

Run linting before finalizing.

```sh
pnpm lint-fix
```

Because this changes exported API and runtime behavior, add a patch changeset for `effect`.
