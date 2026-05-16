---
book: Effect `Schedule` Cookbook
section_number: "33.1"
section_title: "Space calls to a third-party API"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "33. Respect Rate Limits"
status: "draft"
code_included: true
---

# 33.1 Space calls to a third-party API

A worker has a queue of requests to send to a third-party API. The provider
allows steady traffic, but bursts can burn quota, trigger 429 responses, or make
your own retries arrive at the worst possible time. This recipe keeps the
normal call cadence visible with `Schedule.spaced`, and keeps transient retry
behavior as a separate policy around each call.

## Problem

You need to send work to a third-party API without firing the next request as
soon as the previous one finishes. The delay should be easy to review: one
successful call completes, then the worker waits, then it asks for the next item
and calls the API again.

At the same time, a single call may still need a small retry policy for
transient failures such as timeouts, temporary unavailability, or a retryable
rate-limit response. That retry policy should not obscure the main quota
spacing policy.

Use `Schedule.spaced(duration)` with `Effect.repeat` for the outer call cadence,
and use `Effect.retry` around the individual third-party call when retrying is
safe.

## When to use it

Use this when a single worker, fiber, or shard should avoid back-to-back calls
to a provider. It fits ingestion jobs, webhook delivery, enrichment pipelines,
and partner API synchronization where the provider publishes a rough quota such
as "about one request per second" or where experience shows that bursts cause
throttling.

Use it when "wait after each completed call" is the intended behavior.
`Schedule.spaced("1 second")` measures the gap after the previous run finishes,
so slower API responses naturally reduce the request rate.

## When not to use it

Do not treat this as a global rate limiter. If many processes, hosts, tenants,
or shards call the same provider, each local `Schedule.spaced` loop controls
only its own recurrence. Use shared admission control when the quota is global.

Do not retry unsafe writes unless the API supports idempotency keys or another
deduplication mechanism. A timeout can mean the provider accepted the request
but the client did not receive the response.

Do not use this when the provider gives an exact `Retry-After` value and that
value must be followed precisely. In that case, classify the response and build
a policy from the provider signal.

## Schedule shape

The outer shape is deliberately small:

```ts
Schedule.spaced("1 second")
```

With `Effect.repeat`, the effect runs once immediately. After a successful run,
the schedule waits one second before allowing the next recurrence. The elapsed
time spent inside the API call is not subtracted from the delay; this is a
spacing policy, not a fixed wall-clock rate.

For a worker that must not run forever, add a recurrence limit:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(100))
)
```

That means the original run plus at most 100 successful recurrences. For a
long-lived supervised worker, the fiber lifetime may be the stop condition
instead.

## Code

```ts
import { Effect, Schedule } from "effect"

type PartnerEvent = {
  readonly idempotencyKey: string
  readonly payload: string
}

type PartnerResponse = {
  readonly acceptedId: string
}

type PartnerError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "RateLimited" }
  | { readonly _tag: "Rejected"; readonly reason: string }

declare const nextEvent: Effect.Effect<PartnerEvent>

declare const postToPartner: (
  event: PartnerEvent
) => Effect.Effect<PartnerResponse, PartnerError>

const retryTransientCallFailure = Schedule.exponential("200 millis").pipe(
  Schedule.satisfiesInputType<PartnerError>(),
  Schedule.while(({ input }) => input._tag !== "Rejected"),
  Schedule.both(Schedule.recurs(3))
)

const sendOneEvent = Effect.fnUntraced(function*(event: PartnerEvent) {
  return yield* postToPartner(event).pipe(
    Effect.retry(retryTransientCallFailure)
  )
})

const sendEventsToPartner = nextEvent.pipe(
  Effect.flatMap(sendOneEvent),
  Effect.repeat(Schedule.spaced("1 second"))
)
```

`sendEventsToPartner` asks for the first event and calls the provider
immediately. If the call succeeds, the worker waits one second before asking
for and sending the next event.

If a call fails with `Timeout`, `Unavailable`, or `RateLimited`, `Effect.retry`
handles that individual call with up to three retries using exponential delays
starting at 200 milliseconds. `Rejected` stops the retry schedule immediately.
Only after the call eventually succeeds does the outer one-second spacing
schedule move the worker to the next event. If the call still fails after the
retry policy stops, the whole repeat stops with that typed failure.

## Variants

Add jitter when many local workers use the same cadence and do not need exact
spacing:

```ts
const partnerCadence = Schedule.spaced("1 second").pipe(
  Schedule.jittered
)
```

In Effect, `Schedule.jittered` adjusts each recurrence delay between 80% and
120% of the original delay. That turns a one-second spacing into a delay between
800 milliseconds and 1.2 seconds, which helps workers avoid moving together.

For a batch job, bound the number of successful sends:

```ts
const sendAtMostOneHundredEvents = nextEvent.pipe(
  Effect.flatMap(sendOneEvent),
  Effect.repeat(
    Schedule.spaced("1 second").pipe(
      Schedule.both(Schedule.recurs(100))
    )
  )
)
```

For a stricter provider quota, increase the spacing. For a provider that allows
small bursts but enforces a minute-level quota, pair this local spacing with a
real rate limiter instead of trying to encode every quota rule in a repeat
schedule.

## Notes and caveats

`Schedule.spaced` delays recurrences; it does not delay the first call. If the
first call must wait too, sleep or acquire a permit before entering the repeat.

`Effect.repeat` feeds successful values into the schedule. `Effect.retry` feeds
typed failures into the retry schedule. Keeping those two schedules separate
makes it clear which policy protects the provider from normal traffic and which
policy handles transient call failure.

Spacing reduces pressure, but it is not the same as quota accounting. If the
third-party quota is per account, per API key, or per region, enforce that
shared limit outside the local loop.

Classify non-retryable provider responses before retrying. Authentication
errors, validation failures, permanent rejection, and non-idempotent duplicate
risks should fail fast or move the event to a dead-letter path rather than
being hidden behind the retry schedule.
