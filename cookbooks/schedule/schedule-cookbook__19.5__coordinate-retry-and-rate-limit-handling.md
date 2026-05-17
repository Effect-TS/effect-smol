---
book: "Effect `Schedule` Cookbook"
section_number: "19.5"
section_title: "Coordinate retry and rate-limit handling"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "19. Rate Limits and User-Facing Effects"
status: "draft"
code_included: true
---

# 19.5 Coordinate retry and rate-limit handling

Retries and rate limits answer different questions. Classification decides
whether another attempt is allowed; the schedule decides when that attempt may
happen.

## Problem

An external API can fail in several ways:

- `RateLimited`: retryable, but only after the provider's requested delay
- `ServiceUnavailable`: retryable with ordinary backoff
- `BadRequest`: not retryable; the request must be fixed

The retry policy should make both decisions explicit. `BadRequest` should not
enter the retry schedule. `RateLimited` should wait at least as long as the
provider asked. `ServiceUnavailable` can use normal backoff.

## Recommended policy

Classify first with `Effect.retry({ while })`. Then use a schedule that can
observe the typed retry input. `Schedule.identity<ApiError>()` exposes the
current failure as the schedule output; `Schedule.modifyDelay` can choose a
delay that matches that failure.

## Code

```ts
import { Console, Duration, Effect, Ref, Schedule } from "effect"

type ApiError =
  | {
    readonly _tag: "RateLimited"
    readonly retryAfter: Duration.Duration
  }
  | {
    readonly _tag: "ServiceUnavailable"
  }
  | {
    readonly _tag: "BadRequest"
    readonly reason: string
  }

const isRetryable = (error: ApiError): boolean =>
  error._tag === "RateLimited" || error._tag === "ServiceUnavailable"

const retryPolicy = Schedule.identity<ApiError>().pipe(
  Schedule.both(Schedule.exponential("10 millis")),
  Schedule.modifyDelay(([error], computedDelay) => {
    const delay = error._tag === "RateLimited"
      ? Duration.max(computedDelay, error.retryAfter)
      : computedDelay

    return Console.log(
      `delay for ${error._tag}: ${Duration.toMillis(delay)}ms`
    ).pipe(Effect.as(delay))
  }),
  Schedule.both(Schedule.recurs(5))
)

const callProvider = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`provider attempt ${attempt}`)

  if (attempt === 1) {
    return yield* Effect.fail({ _tag: "ServiceUnavailable" } as const)
  }

  if (attempt === 2) {
    return yield* Effect.fail({
      _tag: "RateLimited",
      retryAfter: Duration.millis(35)
    } as const)
  }

  return "provider-ok"
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const result = yield* callProvider(attempts).pipe(
    Effect.retry({
      schedule: retryPolicy,
      while: isRetryable
    })
  )
  yield* Console.log(`result: ${result}`)
})

Effect.runPromise(program)
```

This policy allows at most five retries after the original call. Ordinary
service unavailability follows the exponential delay. Rate limits use the larger
of the exponential delay and the provider's `retryAfter` value, so the client
never retries earlier than the rate-limit response requested.

## Why the pieces are separate

The `while` predicate is the classification boundary. It says which typed errors
are safe to retry. Permanent failures, validation failures, authorization
failures, and unsafe write failures should be rejected there.

The `Schedule` is the timing boundary. It says how retryable failures are paced
after classification has allowed them. Because retry schedules receive failures
as input, timing can still distinguish a rate-limit response from a server
unavailable response.

`Schedule.both` combines the typed input schedule with exponential backoff. The
combined schedule recurs only while both sides recur, and it uses the maximum of
their delays. `Schedule.recurs(5)` adds a hard retry count.

## Variants

If provider guidance must be followed exactly, use a schedule whose base delay
does not add extra backoff for `RateLimited` errors. If many clients may retry
together, add jitter only after deciding whether the provider contract allows
it.

If the operation is user-facing, combine the retry count with a time budget such
as `Schedule.during("10 seconds")` so callers get a bounded response. Background
workers can use longer budgets with clear logging around the rate-limited path.

## Notes and caveats

`Effect.retry` schedules typed failures from the error channel. It does not turn
defects or interruptions into retryable errors.

The first call is not delayed. The schedule controls waits between retry
attempts after a failure.

`Schedule.modifyDelay` replaces the delay chosen by the schedule. Use it when
the rate-limit delay should be compared with, or override, computed backoff. Use
`Schedule.addDelay` when provider delay should be added on top of an existing
delay.

Retries do not make side effects safe. For writes, classification must account
for idempotency keys, deduplication, or another domain guarantee before any
schedule is applied.
