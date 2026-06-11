# HttpClient RateLimiter Retry-After Persistence Specification

## Summary

Fix `HttpClient.withRateLimiter` so already queued requests respect `Retry-After` response headers without storing the new coordination state inside the HTTP client wrapper.

The fix must keep the public `RateLimiter` service interface unchanged. It must not add methods to `RateLimiter`, and it must not add parameters to `RateLimiter.consume`. Instead, the shared `Retry-After` state should be modeled as top-level required methods on `RateLimiterStore` named `setRetryAfter` and `getRetryAfter`.

The HTTP client should parse response headers and record server-imposed backoff through the limiter implementation. The limiter should then make ordinary `consume` calls respect that stored backoff before mutating fixed-window or token-bucket state.

## Background

Issue #2311 reports that `HttpClient.withRateLimiter` allows already queued requests to bypass a newly observed `Retry-After` response header.

The failing scenario is:

1. Several requests start concurrently with the same rate-limit key.
2. The current implementation asks the limiter for each request's delay up front.
3. Request 2 later receives `429` with `Retry-After: 2`.
4. Request 3 has already captured its original delay and sends too early.
5. The server receives request 3 before the `Retry-After` period has elapsed.

The first PR fixed the local behavior by adding a `blockedUntil` map inside `HttpClient.withRateLimiter`. That made queued requests in the same wrapper respect `Retry-After`, but it placed limiter state in the HTTP client wrapper. That state is not shared across wrappers, limiter instances, processes, or future persisted stores.

Before this PR, response-derived rate-limit information was already local to the HTTP client wrapper through `const states = new Map<string, RateLimiterState>()`. The new fix should avoid adding more local limiter state. Persisting all response-derived limit/window state is out of scope for this specification unless maintainers request a broader redesign.

## Requirements and Clarifications

1. Fix the queued-request `Retry-After` bug from #2311.
2. Do not add a method to the `RateLimiter` interface.
3. Do not add a parameter to `RateLimiter.consume`.
4. Do not nest methods inside a service interface.
5. Use top-level `RateLimiterStore` methods named `setRetryAfter` and `getRetryAfter`.
6. Keep `disableResponseInspection: true` behavior unchanged. It must ignore `Retry-After` response headers.
7. Keep the sleep-and-recheck acquisition behavior so queued requests do not keep stale precomputed delays.
8. Do not encode `Retry-After` as fake token debt. `Retry-After` means “do not send before this time”, not “consume extra capacity”.
9. Do not require `HttpClient.withRateLimiter` callers to provide `RateLimiterStore` in the environment. The options object already contains the `RateLimiter` instance.
10. Custom stores that do not implement `setRetryAfter` / `getRetryAfter` should continue to work. They may not provide shared `Retry-After` coordination.
11. Repository-provided memory and Redis stores should implement `setRetryAfter` / `getRetryAfter`.
12. Add a changeset because this changes runtime behavior.

## Non-Goals

1. Do not redesign `RateLimiter`.
2. Do not add a public `RateLimiter.block` method.
3. Do not add `blockFor`, `retryAfter`, or any similar option to `RateLimiter.consume`.
4. Do not solve persistence for the existing `HttpClient.withRateLimiter` `states` map that tracks header-derived `limit` and `window` values.
5. Do not change default behavior for users who do not use `HttpClient.withRateLimiter` response inspection.

## Proposed API Shape

### `RateLimiter` Interface

The `RateLimiter` interface remains unchanged.

```ts
export interface RateLimiter {
  readonly [TypeId]: TypeId

  readonly consume: (options: {
    readonly algorithm?: "fixed-window" | "token-bucket" | undefined
    readonly onExceeded?: "delay" | "fail" | undefined
    readonly window: Duration.Input
    readonly limit: number
    readonly key: string
    readonly tokens?: number | undefined
  }) => Effect.Effect<ConsumeResult, RateLimiterError>
}
```

### `RateLimiterStore` Interface

Add required top-level methods to `RateLimiterStore`.

```ts
export class RateLimiterStore extends Context.Service<
  RateLimiterStore,
  {
    readonly fixedWindow: (options: {
      readonly key: string
      readonly tokens: number
      readonly refillRate: Duration.Duration
      readonly limit: number | undefined
    }) => Effect.Effect<readonly [count: number, ttl: number], RateLimiterError>

    readonly tokenBucket: (options: {
      readonly key: string
      readonly tokens: number
      readonly limit: number
      readonly refillRate: Duration.Duration
      readonly allowOverflow: boolean
    }) => Effect.Effect<number, RateLimiterError>

    readonly setRetryAfter: (options: {
      readonly key: string
      readonly duration: Duration.Duration
    }) => Effect.Effect<void, RateLimiterError>

    readonly getRetryAfter: (options: {
      readonly key: string
    }) => Effect.Effect<Duration.Duration, RateLimiterError>
  }
>()("effect/persistence/RateLimiter/RateLimiterStore") {}
```

All `RateLimiterStore` implementations must provide these methods.

## `setRetryAfter` / `getRetryAfter` Semantics

`setRetryAfter` records a server-imposed backoff for a rate-limit key.

Input:

```ts
{
  key: string
  duration: Duration.Duration
}
```

Behavior:

1. Compute `until = now + duration`.
2. If the key has no existing retry-after deadline, store `until`.
3. If the key has an earlier existing deadline, replace it with `until`.
4. If the key has a later existing deadline, keep the later deadline.
5. A shorter later `Retry-After` must not shorten an existing longer block.

`getRetryAfter` returns the remaining retry-after delay for a key.

Input:

```ts
{
  key: string
}
```

Behavior:

1. If no retry-after deadline exists, return `Duration.zero`.
2. If the deadline has expired, clear it when practical and return `Duration.zero`.
3. If the deadline is in the future, return `Duration.millis(deadline - now)`.

The returned duration represents how long a normal `consume` call should wait or fail for before this key may consume again.

## RateLimiter Implementation Requirements

`RateLimiter.make` should consult `store.getRetryAfter` at the start of every `consume` call, before touching fixed-window or token-bucket state.

Plain English behavior:

1. A caller asks to consume capacity for a key.
2. The limiter asks the store whether the key is under a stored retry-after block.
3. If the store says there is a remaining delay, the limiter returns the same kind of result it already returns when a rate limit is exceeded.
4. If there is no remaining delay, the limiter continues with the existing fixed-window or token-bucket logic.

Pseudo-code:

```ts
consume(options) {
  const tokens = options.tokens ?? 1
  const onExceeded = options.onExceeded ?? "fail"
  const retryAfter = store.getRetryAfter === undefined
    ? Effect.succeed(Duration.zero)
    : store.getRetryAfter({ key: options.key })

  return Effect.flatMap(retryAfter, (delay) => {
    if (!Duration.isZero(delay)) {
      if (onExceeded === "fail") {
        return Effect.fail(
          new RateLimiterError({
            reason: new RateLimitExceeded({
              key: options.key,
              retryAfter: delay,
              limit: options.limit,
              remaining: 0
            })
          })
        )
      }

      return Effect.succeed<ConsumeResult>({
        delay,
        limit: options.limit,
        remaining: 0,
        resetAfter: delay
      })
    }

    // Existing token > limit handling, fixed-window logic, and token-bucket logic continue here.
  })
}
```

The retry-after check must not consume normal fixed-window or token-bucket capacity. A blocked request should not mutate normal limiter counters.

## Recording Retry-After Without Changing the RateLimiter Interface

`HttpClient.withRateLimiter` receives a concrete `RateLimiter` in options. It should not require `RateLimiterStore`, but it can optionally read `RateLimiterStore` from the current fiber context when response inspection sees a `Retry-After` header.

Plain English behavior:

1. `HttpClient` parses `Retry-After` from the response.
2. It calls `Effect.serviceOption(RateLimiterStore)`.
3. If the store is present and implements `setRetryAfter`, it records the retry-after delay.
4. If the store is absent, it does nothing.

This preserves the `RateLimiter` interface and avoids hidden capability plumbing on limiter values.

## Memory Store Requirements

The memory store should implement `setRetryAfter` and `getRetryAfter` with a map local to the store instance.

Example:

```ts
const retryAfter = new Map<string, number>()

setRetryAfter: (options) =>
  Effect.clockWith((clock) =>
    Effect.sync(() => {
      const until = clock.currentTimeMillisUnsafe() + Duration.toMillis(options.duration)
      retryAfter.set(options.key, Math.max(retryAfter.get(options.key) ?? 0, until))
    })
  ),

getRetryAfter: (options) =>
  Effect.clockWith((clock) =>
    Effect.sync(() => {
      const until = retryAfter.get(options.key)
      if (until === undefined) {
        return Duration.zero
      }
      const now = clock.currentTimeMillisUnsafe()
      if (until <= now) {
        retryAfter.delete(options.key)
        return Duration.zero
      }
      return Duration.millis(until - now)
    })
  )
```

The map belongs to `RateLimiterStore.layerStoreMemory`, not `HttpClient.withRateLimiter`.

## Redis Store Requirements

The Redis store should implement `setRetryAfter` and `getRetryAfter` using a separate retry-after key derived from the limiter key.

Recommended key shape:

```ts
const key = `${prefix}${options.key}:retry-after`
```

`getRetryAfter` should read the remaining TTL:

1. If Redis returns a positive `PTTL`, return `Duration.millis(ttl)`.
2. If Redis returns `-2` for missing key, return `Duration.zero`.
3. If Redis returns `-1` for a key without expiry, return `Duration.zero` and avoid treating it as an infinite block.

`setRetryAfter` should extend the TTL without shortening an existing longer TTL. A Lua script is preferable because it is atomic and works across processes.

Example Lua behavior:

```lua
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local current = tonumber(redis.call("PTTL", key) or "-2")

if current < ttl then
  redis.call("SET", key, "1", "PX", ttl)
end

return 0
```

The Redis implementation should map Redis command/script failures into `RateLimiterError` with `RateLimitStoreError`, matching the existing store error style.

## HttpClient Implementation Requirements

Remove the local retry-after block state from `HttpClient.withRateLimiter`.

Remove:

```ts
const blockedUntil = new Map<string, number>()
```

Remove any local `waitForBlock` helper.

Keep the fail/sleep/retry acquisition loop. That loop is what prevents queued requests from using stale precomputed delays.

Before sending a request:

```ts
options.limiter.consume({
  algorithm: options.algorithm,
  onExceeded: "fail",
  key,
  limit: current.limit,
  window: current.window,
  tokens
})
```

If the limiter reports `RateLimitExceeded`, sleep for `error.reason.retryAfter` and call the loop again.

```ts
if (isRateLimitExceeded(error)) {
  return Effect.flatMap(Effect.sleep(error.reason.retryAfter), () => loop(effect, request))
}
```

Make response inspection effectful so it can call `RateLimiter.setRetryAfter`.

Example:

```ts
const onResponse = options.disableResponseInspection
  ? undefined
  : (clock: Clock, key: string, headers: Headers.Headers, tokens: number) =>
    Effect.gen(function*() {
      const current = getState(key)
      const next = parseRateLimiterState(current, clock, headers, tokens)
      if (next.limit !== current.limit || !Duration.equals(next.window, current.window)) {
        states.set(key, next)
      }

      const retryAfter = parseRetryAfter(clock, getHeader(headers, "retry-after"))
      if (retryAfter !== undefined) {
        const store = yield* Effect.serviceOption(RateLimiter.RateLimiterStore)
        if (Option.isSome(store)) {
          yield* store.value.setRetryAfter({ key, duration: retryAfter })
        }
      }
    })
```

Then call it before deciding whether to retry a `429` response:

```ts
onSuccess(response) {
  return Effect.andThen(
    onResponse?.(clock, key, response.headers, tokens) ?? Effect.void,
    response.status !== 429 ? Effect.succeed(response) : retry(response)
  )
}
```

The `HttpClientError` 429 path should use the same effectful inspection before retrying.

When `disableResponseInspection: true`, `onResponse` remains `undefined`; no retry-after state is recorded.

## Behavioral Examples

### Single Wrapper Queued Requests

Configuration:

```ts
HttpClient.withRateLimiter({
  limiter,
  key: "api",
  limit: 1,
  window: "100 millis"
})
```

Timeline:

1. Request 1 sends at `0ms`.
2. Request 2 sends at `100ms` and receives `429` with `Retry-After: 0.2`.
3. The client records retry-after in the limiter store for key `api`.
4. Request 3 was already queued, but it loops through `consume` again before sending.
5. `consume` sees the stored retry-after delay and rejects/delays it until `300ms`.
6. Request 3 does not send at `200ms`.

### Separate Wrappers Sharing a Limiter

Two independent HTTP client wrappers use the same limiter and key.

```ts
const clientA = baseA.pipe(HttpClient.withRateLimiter(options))
const clientB = baseB.pipe(HttpClient.withRateLimiter(options))
```

If `clientA` receives `Retry-After`, then `clientB` should also wait because the retry-after state is stored through `RateLimiterStore`, not in `clientA`'s wrapper closure.

### Separate Limiters Sharing a Store

Two limiter values are created from the same `RateLimiterStore` service.

```ts
const limiterA = yield* RateLimiter.make
const limiterB = yield* RateLimiter.make
```

If `limiterA` records retry-after through `clientA`, then `limiterB.consume` should also see the delay when both use the same key. This proves the state is store-backed, not limiter-object-backed.

## Testing Requirements

### RateLimiter Store Tests

Add focused tests for `setRetryAfter` / `getRetryAfter` through the memory store.

Required coverage:

1. `getRetryAfter` returns `Duration.zero` when no retry-after value exists.
2. `setRetryAfter` stores a retry-after duration.
3. `getRetryAfter` returns the remaining duration before expiry.
4. `getRetryAfter` returns `Duration.zero` after expiry.
5. A shorter later `setRetryAfter` does not shorten an existing longer retry-after deadline.
6. A longer later `setRetryAfter` extends the existing retry-after deadline.

### RateLimiter Consume Tests

Add tests proving ordinary `consume` honors retry-after state through the store.

Required coverage:

1. `consume({ onExceeded: "fail" })` fails with `RateLimitExceeded` while retry-after is active.
2. The `RateLimitExceeded.retryAfter` value is the remaining retry-after delay.
3. `consume({ onExceeded: "delay" })` succeeds with a non-zero `ConsumeResult.delay` while retry-after is active.
4. `consume` does not consume normal fixed-window/token-bucket capacity while retry-after is active.
5. After retry-after expires, normal consume behavior resumes.

### HttpClient Tests

Keep and adapt the tests added for #2311.

Required coverage:

1. Already queued requests in the same `withRateLimiter` wrapper respect `Retry-After` from a `429` response.
2. Already queued requests ignore `Retry-After` when `disableResponseInspection: true`.
3. Already queued requests respect `Retry-After` when `429` is surfaced as `HttpClientError` through `HttpClient.filterStatusOk`.
4. Separate `withRateLimiter` wrappers sharing the same limiter and key share retry-after state.
5. Separate limiter instances created from the same store share retry-after state.

Example separate-wrapper test shape:

```ts
it.effect("shares Retry-After across separate rate-limited clients", () =>
  Effect.gen(function*() {
    const attemptsA = yield* Ref.make(0)
    const attemptsB = yield* Ref.make(0)
    const limiter = yield* RateLimiter.RateLimiter

    const options = {
      limiter,
      key: "test",
      limit: 1,
      window: "100 millis"
    } as const

    const clientA = HttpClient.make((request) =>
      Effect.map(
        Ref.updateAndGet(attemptsA, (n) => n + 1),
        (attempt) =>
          HttpClientResponse.fromWeb(
            request,
            attempt === 2
              ? new Response(null, {
                status: 429,
                headers: { "Retry-After": "0.2" }
              })
              : new Response(null, { status: 200 })
          )
      )
    ).pipe(HttpClient.withRateLimiter(options))

    const clientB = HttpClient.make((request) =>
      Effect.map(
        Ref.updateAndGet(attemptsB, (n) => n + 1),
        () => HttpClientResponse.fromWeb(request, new Response(null, { status: 200 }))
      )
    ).pipe(HttpClient.withRateLimiter(options))

    const fiberA = yield* Effect.forEach([1, 2], (n) => clientA.get(`http://test/a/${n}`), {
      concurrency: "unbounded",
      discard: true
    }).pipe(Effect.forkChild({ startImmediately: true }))

    yield* TestClock.adjust("100 millis")
    strictEqual(yield* Ref.get(attemptsA), 2)

    const fiberB = yield* clientB.get("http://test/b").pipe(
      Effect.forkChild({ startImmediately: true })
    )

    // Different wrapper, same limiter key. It must see clientA's Retry-After.
    yield* TestClock.adjust("199 millis")
    strictEqual(yield* Ref.get(attemptsB), 0)

    yield* TestClock.adjust("1 millis")
    yield* Fiber.join(fiberB)
    yield* Fiber.join(fiberA)

    strictEqual(yield* Ref.get(attemptsB), 1)
  }).pipe(Effect.provide(RateLimiterTestLayer)))
```

## Acceptance Criteria

1. `RateLimiter` interface is unchanged.
2. `RateLimiter.consume` options are unchanged.
3. `RateLimiterStore` has required top-level `setRetryAfter` and `getRetryAfter` methods.
4. No service interface nests retry-after methods inside another object.
5. Memory store implements `setRetryAfter` and `getRetryAfter`.
6. Redis store implements `setRetryAfter` and `getRetryAfter`.
7. `RateLimiter.consume` consults `getRetryAfter` before mutating normal limiter counters.
8. `RateLimiter.consume({ onExceeded: "fail" })` fails with `RateLimitExceeded` while retry-after is active.
9. `RateLimiter.consume({ onExceeded: "delay" })` returns a delayed `ConsumeResult` while retry-after is active.
10. `HttpClient.withRateLimiter` has no local retry-after `Map`.
11. `HttpClient.withRateLimiter` records `Retry-After` through an optionally available `RateLimiterStore` when response inspection is enabled.
12. `disableResponseInspection: true` does not record retry-after state.
13. Already queued requests re-check limiter state before sending and do not use stale precomputed delays.
14. Separate HTTP client wrappers sharing a limiter and key share retry-after state.
15. Separate limiter instances sharing a store and key share retry-after state.
16. Custom `RateLimiterStore` implementations are updated to provide retry-after methods.
17. A changeset documents the runtime behavior change.
18. Targeted tests, linting, and type checking pass.

## Implementation Tasks

### Task 1: Revert local HttpClient retry-after state from the current PR

Status: Pending.

Scope:

- `packages/effect/src/unstable/http/HttpClient.ts`.

Steps:

1. Remove `const blockedUntil = new Map<string, number>()` from `withRateLimiter`.
2. Remove the local `waitForBlock` helper.
3. Remove any call to `waitForBlock` from the request loop.
4. Keep the `onExceeded: "fail"` sleep-and-retry acquisition behavior.
5. Verify no local retry-after-only state remains in `HttpClient.withRateLimiter`.

Validation:

1. Run `pnpm test packages/effect/test/unstable/http/HttpClient.test.ts` and expect the queued retry-after tests to fail until later tasks are complete.

### Task 2: Add required top-level retry-after methods to RateLimiterStore

Status: Pending.

Scope:

- `packages/effect/src/unstable/persistence/RateLimiter.ts`.

Steps:

1. Add required `setRetryAfter` to the `RateLimiterStore` service shape.
2. Add required `getRetryAfter` to the `RateLimiterStore` service shape.
3. Use `Duration.Duration` for stored durations, matching existing store method style.
4. Keep the methods top-level on the service shape.
5. Do not add a nested `retryAfter` object.
6. Do not change the `RateLimiter` interface.
7. Do not change `RateLimiter.consume` options.

Validation:

1. Run `pnpm check:tsgo` or a narrower type check if available.

### Task 3: Implement retry-after state in the memory store

Status: Pending.

Scope:

- `packages/effect/src/unstable/persistence/RateLimiter.ts`.

Steps:

1. Add a `Map<string, number>` inside `layerStoreMemory` for retry-after deadlines.
2. Implement `setRetryAfter` using the current `Clock` and max(existing, new deadline).
3. Implement `getRetryAfter` using the current `Clock`.
4. Delete expired entries when practical.
5. Return `Duration.zero` when no active retry-after deadline exists.

Validation:

1. Add or run focused `RateLimiter` tests for memory retry-after behavior.

### Task 4: Implement retry-after state in the Redis store

Status: Pending.

Scope:

- `packages/effect/src/unstable/persistence/RateLimiter.ts`.

Steps:

1. Add a Redis script for extending retry-after TTL without shortening it.
2. Use a retry-after key derived from the existing Redis prefix and limiter key.
3. Implement `setRetryAfter` with the Lua script.
4. Implement `getRetryAfter` using Redis `PTTL` or the existing Redis abstraction's equivalent.
5. Map Redis failures to `RateLimiterError` with `RateLimitStoreError`.
6. Ensure missing keys and no-expiry keys produce `Duration.zero` rather than an infinite block.

Validation:

1. Run `pnpm check:tsgo`.
2. Run any existing Redis rate-limiter tests if present.

### Task 5: Make RateLimiter.consume honor stored retry-after state

Status: Pending.

Scope:

- `packages/effect/src/unstable/persistence/RateLimiter.ts`.

Steps:

1. At the start of `consume`, call `store.getRetryAfter({ key: options.key })`.
2. If retry-after delay is non-zero and `onExceeded === "fail"`, fail with `RateLimiterError` / `RateLimitExceeded`.
3. If retry-after delay is non-zero and `onExceeded === "delay"`, succeed with `ConsumeResult.delay` set to the remaining retry-after delay.
4. Do not call `fixedWindow` or `tokenBucket` when retry-after is active.
5. Preserve existing behavior when retry-after is inactive.

Validation:

1. Add or run focused `RateLimiter.consume` tests.
2. Run `pnpm check:tsgo`.

### Task 6: Keep retry-after recording out of the RateLimiter interface

Status: Pending.

Scope:

- `packages/effect/src/unstable/persistence/RateLimiter.ts`.

Steps:

1. Do not add a retry-after method to the `RateLimiter` interface.
2. Do not add a retry-after parameter to `RateLimiter.consume`.
3. Do not attach hidden retry-after capability state to limiter values.
4. Keep retry-after recording on `RateLimiterStore` only.

Validation:

1. Confirm `RateLimiter` still exposes only `consume`.
2. Run `pnpm check:tsgo`.

### Task 7: Update HttpClient.withRateLimiter to record Retry-After through optional store access

Status: Pending.

Scope:

- `packages/effect/src/unstable/http/HttpClient.ts`.

Steps:

1. Use `Effect.serviceOption(RateLimiter.RateLimiterStore)` when a parsed `Retry-After` header needs to be recorded.
2. Make `onResponse` effectful.
3. Keep existing `RateLimiterState` parsing and local `states` map behavior for `limit` and `window`.
4. Parse `Retry-After` from response headers.
5. If the optional store is present, call `setRetryAfter` with the key and parsed retry-after duration.
6. Ensure the success response path waits for `onResponse` before deciding whether to return or retry.
7. Ensure the `HttpClientError` 429 path waits for `onResponse` before retrying.
8. Preserve `disableResponseInspection: true` behavior by leaving `onResponse` undefined.
9. Tests that assert retry-after recording should provide `RateLimiterStore` in the environment.

Validation:

1. Run `pnpm test packages/effect/test/unstable/http/HttpClient.test.ts`.

### Task 8: Add distributed-shape regression tests

Status: Pending.

Scope:

- `packages/effect/test/unstable/http/HttpClient.test.ts`.
- Potentially a focused `RateLimiter` test file if one exists or is appropriate.

Steps:

1. Keep the same-wrapper queued retry-after test.
2. Keep the disabled response inspection test.
3. Keep the `HttpClientError` 429 retry-after test.
4. Add a test with two separate HTTP client wrappers sharing the same limiter and key.
5. Add a test with two separately created limiter instances sharing the same store and key.
6. Use `TestClock` for all timing assertions.
7. Add minimal comments explaining timing boundaries.

Validation:

1. Run `pnpm test packages/effect/test/unstable/http/HttpClient.test.ts`.

### Task 9: Add or update changeset

Status: Pending.

Scope:

- `.changeset/`.

Steps:

1. Ensure a patch changeset exists for `effect`.
2. Mention that `HttpClient.withRateLimiter` now stores `Retry-After` backoff in the limiter store when the store is available in context.
3. Mention that queued requests now re-check current limiter state before sending.

Validation:

1. Confirm the changeset file is present and references `effect`.

### Task 10: Final validation

Status: Pending.

Commands:

1. `pnpm lint-fix`.
2. `pnpm test packages/effect/test/unstable/http/HttpClient.test.ts`.
3. Targeted `RateLimiter` tests added or changed by this work.
4. `pnpm check:tsgo`.

Completion criteria:

1. All commands pass.
2. The final diff does not include local retry-after state in `HttpClient.withRateLimiter`.
3. The final diff does not change the `RateLimiter` interface or `consume` options.
4. The PR description explains why delay logic uses fail/sleep/retry rather than precomputed delay reservations.
