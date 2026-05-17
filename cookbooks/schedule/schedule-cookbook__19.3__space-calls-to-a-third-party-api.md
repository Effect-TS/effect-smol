---
book: "Effect `Schedule` Cookbook"
section_number: "19.3"
section_title: "Space calls to a third-party API"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "19. Rate Limits and User-Facing Effects"
status: "draft"
code_included: true
---

# 19.3 Space calls to a third-party API

Third-party clients usually need two policies: a steady cadence for normal
traffic and a smaller retry policy around each individual call.

## Problem

You need to send requests to a provider without starting the next request as
soon as the previous one finishes. The rule should be easy to review: send one
item, wait, then send the next item.

A single request may still need retries for transient failures such as timeouts,
temporary unavailability, or retryable rate-limit responses. Keep that retry
policy separate from the outer spacing policy so provider quota behavior is not
hidden inside call-level failure handling.

Use `Effect.repeat` with `Schedule.spaced(duration)` for the worker cadence, and
use `Effect.retry` around the one provider call when retrying is safe.

## When to use it

Use this for one worker, fiber, or shard that should avoid back-to-back calls to
a provider. It fits ingestion jobs, webhook delivery, enrichment pipelines, and
partner synchronization where a provider publishes a rough quota such as one
request per second.

Use it when "wait after each completed call" is the intended behavior.
`Schedule.spaced("1 second")` waits after the previous run finishes; slow API
responses naturally reduce the total request rate.

## When not to use it

Do not treat a local schedule as a global rate limiter. If many processes,
hosts, tenants, or shards share one provider quota, coordinate that quota with
shared admission control.

Do not retry unsafe writes unless the API supports idempotency keys or another
deduplication mechanism. A timeout can mean the provider accepted the request
but the client did not receive the response.

Do not use guessed spacing when the provider gives an exact `Retry-After` value
that must be followed. Classify that response and derive the retry delay from
the provider signal.

## Schedule shape

The outer policy is `Schedule.spaced(duration)`. With `Effect.repeat`, the first
effect run starts immediately. After a successful run, the schedule waits before
allowing the next recurrence. The time spent inside the provider call is not
subtracted from the delay; this is spacing, not a fixed wall-clock rate.

Add `Schedule.recurs(n)` when the worker should make only `n` additional
successful recurrences. For a long-lived supervised worker, fiber lifetime or a
queue shutdown signal may be the stop condition instead.

## Example

```ts
import { Console, Effect, Ref, Schedule } from "effect"

type PartnerEvent = {
  readonly idempotencyKey: string
  readonly payload: string
}

type PartnerError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "RateLimited" }
  | { readonly _tag: "Rejected"; readonly reason: string }

const events: ReadonlyArray<PartnerEvent> = [
  { idempotencyKey: "event-1", payload: "alpha" },
  { idempotencyKey: "event-2", payload: "bravo" },
  { idempotencyKey: "event-3", payload: "charlie" }
]

const nextEvent = Effect.fnUntraced(function*(cursor: Ref.Ref<number>) {
  const index = yield* Ref.updateAndGet(cursor, (n) => n + 1)
  const event = events[index - 1]

  if (event === undefined) {
    return yield* Effect.fail({ _tag: "NoMoreEvents" } as const)
  }

  yield* Console.log(`next: ${event.idempotencyKey}`)
  return event
})

const postToPartner = Effect.fnUntraced(function*(
  calls: Ref.Ref<number>,
  event: PartnerEvent
) {
  const callNumber = yield* Ref.updateAndGet(calls, (n) => n + 1)
  yield* Console.log(`provider call ${callNumber}: ${event.payload}`)

  if (callNumber === 1) {
    return yield* Effect.fail({ _tag: "Unavailable" } as const)
  }

  return { acceptedId: `accepted-${event.idempotencyKey}` }
})

const isRetryablePartnerError = (error: PartnerError): boolean =>
  error._tag !== "Rejected"

const retryTransientCallFailure = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)

const sendOneEvent = Effect.fnUntraced(function*(
  cursor: Ref.Ref<number>,
  calls: Ref.Ref<number>
) {
  const event = yield* nextEvent(cursor)
  const response = yield* postToPartner(calls, event).pipe(
    Effect.retry({
      schedule: retryTransientCallFailure,
      while: isRetryablePartnerError
    })
  )
  yield* Console.log(`sent: ${response.acceptedId}`)
})

const program = Effect.gen(function*() {
  const cursor = yield* Ref.make(0)
  const calls = yield* Ref.make(0)

  yield* sendOneEvent(cursor, calls).pipe(
    Effect.repeat(
      Schedule.spaced("25 millis").pipe(
        Schedule.both(Schedule.recurs(2))
      )
    )
  )

  yield* Console.log("done")
})

Effect.runPromise(program)
```

The worker sends the first event immediately. The first provider call fails
once, so `Effect.retry` retries that same event with short exponential spacing.
Only after the call succeeds does the outer `Schedule.spaced` policy wait before
the worker asks for the next event.

## Variants

Add jitter when many local workers use the same cadence and exact spacing is not
required. `Schedule.jittered` adjusts each delay between 80% and 120% of the
computed delay, which helps workers avoid moving together.

For a batch job, combine `Schedule.spaced(duration)` with `Schedule.recurs(n)`.
For a stricter provider quota, increase the spacing. For a quota shared across
workers, use a real rate limiter instead of trying to encode fleet-wide quota
accounting in each local repeat schedule.

## Notes and caveats

`Schedule.spaced` delays recurrences; it does not delay the first call. If the
first call must wait too, sleep or acquire a permit before entering the repeat.

`Effect.repeat` feeds successful values into its schedule. `Effect.retry` feeds
typed failures into its schedule. Keeping those schedules separate makes clear
which policy protects normal traffic and which policy handles transient call
failure.

Classify non-retryable provider responses before retrying. Authentication
errors, validation failures, permanent rejection, and non-idempotent duplicate
risks should fail fast or move the event to a dead-letter path.
