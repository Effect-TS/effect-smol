---
book: Effect `Schedule` Cookbook
section_number: "33.3"
section_title: "Retry with longer spacing after quota signals"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "33. Respect Rate Limits"
status: "draft"
code_included: true
---

# 33.3 Retry with longer spacing after quota signals

Quota signals deserve slower retry timing than ordinary transient failures. Let
the typed failure choose the next delay, then keep the whole policy bounded.

## Problem

A remote API can fail with ordinary transient errors and with quota signals. The
retry policy should:

- retry timeouts and temporary unavailability after a short delay
- wait longer after quota failures
- honor a server-provided retry delay when one is available
- stop after a small number of retries
- avoid retrying permanent failures

## When to use it

Use this when the downstream system tells you to slow down: HTTP `429`,
rate-limit headers, quota-exceeded responses, or service-specific throttle
errors. It fits idempotent client calls and background workers where a later
attempt may succeed after the quota window resets.

## When not to use it

Do not use quota-aware spacing for invalid requests, missing credentials,
forbidden access, nonexistent resources, or unsafe writes. Those failures should
be classified before `Effect.retry`.

Do not use a local retry schedule as a replacement for a real rate limiter. A
retry schedule controls this operation's next attempt; it does not coordinate
all callers that share the same provider quota.

## Schedule shape

`Effect.retry` feeds each typed failure into the schedule. Use
`Schedule.identity<Error>()` to make the current failure the schedule output,
then use `Schedule.modifyDelay` to choose the delay from that failure.

The policy below uses short documentation delays, but the shape is the important
part: ordinary transient failures get a short delay, quota failures get the
provider delay or a conservative fallback, and `Schedule.recurs` caps the retry
count.

## Code

```ts
import { Console, Duration, Effect, Ref, Schedule } from "effect"

type DownstreamError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }
  | {
    readonly _tag: "QuotaExceeded"
    readonly retryAfter: Duration.Duration | undefined
  }
  | { readonly _tag: "BadRequest" }

const isRetryable = (error: DownstreamError): boolean =>
  error._tag === "Timeout" ||
  error._tag === "Unavailable" ||
  error._tag === "QuotaExceeded"

const delayFor = (error: DownstreamError): Duration.Duration => {
  if (error._tag === "QuotaExceeded") {
    return error.retryAfter ?? Duration.millis(80)
  }
  return Duration.millis(15)
}

const quotaAwareRetry = Schedule.identity<DownstreamError>().pipe(
  Schedule.while(({ input }) => isRetryable(input)),
  Schedule.modifyDelay((error) => {
    const delay = delayFor(error)
    return Console.log(
      `retry after ${error._tag}: ${Duration.toMillis(delay)}ms`
    ).pipe(Effect.as(delay))
  }),
  Schedule.both(Schedule.recurs(5))
)

const callDownstream = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`downstream attempt ${attempt}`)

  if (attempt === 1) {
    return yield* Effect.fail({ _tag: "Timeout" } as const)
  }

  if (attempt === 2) {
    return yield* Effect.fail({
      _tag: "QuotaExceeded",
      retryAfter: undefined
    } as const)
  }

  return "accepted"
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const result = yield* callDownstream(attempts).pipe(
    Effect.retry({
      schedule: quotaAwareRetry,
      while: isRetryable
    })
  )
  yield* Console.log(`result: ${result}`)
})

Effect.runPromise(program)
```

The first failure gets the short transient delay. The quota failure gets the
longer fallback delay because it has no explicit `retryAfter` value. A
`BadRequest` would bypass the schedule through the `while` predicate.

## Variants

If every quota signal should use the same local delay, omit `retryAfter` from
the error model and return a fixed quota delay from `delayFor`.

If the API returns reset timestamps or rate-limit headers, parse them where the
HTTP response is classified. The schedule should receive a domain error with a
ready-to-use `Duration`, not raw headers.

If many workers can hit the same quota at once, add randomness above the
required minimum delay or coordinate through shared rate-limit state.

## Notes and caveats

Longer spacing after quota signals reduces pressure; it does not guarantee
fairness across a fleet. Use shared rate-limit state, queues, or provider
specific quota coordination when multiple processes share one allowance.

Keep retry counts low unless the operation is explicitly background work.
Quota-aware retries can otherwise turn a short caller path into a long,
surprising wait.
