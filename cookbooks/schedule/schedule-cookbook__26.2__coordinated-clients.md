---
book: Effect `Schedule` Cookbook
section_number: "26.2"
section_title: "Coordinated clients"
part_title: "Part VI — Jitter Recipes"
chapter_title: "26. Why Jitter Exists"
status: "draft"
code_included: true
---

# 26.2 Coordinated clients

Use this recipe to add jitter when client follow-up calls would otherwise move
as one wave. In Effect, `Schedule.jittered` adjusts each recurrence delay to a
random value between `80%` and `120%` of the delay produced by the schedule it
wraps.

## Problem

Coordinated clients start from the same signal and then keep making follow-up
calls on the same cadence. A deploy, a cache expiry, a feature flag flip, or a
shared upstream outage can make hundreds of clients fail or poll together. If
every client retries after exactly `100 millis`, then `200 millis`, then
`400 millis`, a schedule that is polite for one client can become noisy for the
service receiving all of them.

The recurrence policy should still be easy to review: the base cadence, retry
limit, polling budget, and final stop condition should remain visible in the
code.

## When to use it

Use jitter when clients share a start time or a failure mode:

- browser clients reconnecting after a network interruption
- service instances retrying the same downstream dependency
- workers polling for the completion of jobs created in batches
- scheduled processes that are deployed, restarted, or released together

The more instances share the same cadence, the more useful jitter becomes. It is especially helpful when the downstream service has rate limits, queue depth limits, or expensive cold paths.

## When not to use it

Do not add jitter when exact timing is the product requirement. A metronomic heartbeat, a fixed billing boundary, or a protocol-level timeout may need a predictable `Schedule.fixed` or `Schedule.spaced` cadence.

Also do not use jitter to disguise errors that should not be retried. Validation failures, authorization failures, malformed requests, and unsafe non-idempotent writes should be classified before the schedule is applied.

## Schedule shape

Choose the deterministic shape first, then jitter it:

1. Start with the cadence: `Schedule.exponential`, `Schedule.spaced`, or another base schedule.
2. Apply `Schedule.jittered` so each recurrence delay is spread around that cadence.
3. Add limits such as `Schedule.recurs` or `Schedule.during`.

That order keeps the operational intent readable. `Schedule.exponential("100 millis").pipe(Schedule.jittered, Schedule.both(Schedule.recurs(5)))` still says "exponential retry, jittered, at most five recurrences."

## Code

```ts
import { Effect, Schedule } from "effect"

type ClientError = { readonly _tag: "ClientError"; readonly message: string }

declare const fetchSharedResource: Effect.Effect<string, ClientError>

const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

export const program = Effect.retry(fetchSharedResource, retryPolicy)
```

For polling, jitter the spacing for the repeated successful observations:

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly _tag: "Running" }
  | { readonly _tag: "Completed" }

type StatusError = { readonly _tag: "StatusError" }

declare const readJobStatus: Effect.Effect<JobStatus, StatusError>

const pollPolicy = Schedule.spaced("2 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Running"),
  Schedule.both(Schedule.during("1 minute"))
)

export const pollUntilDone = Effect.repeat(readJobStatus, pollPolicy)
```

## Variants

Use `Schedule.exponential(...).pipe(Schedule.jittered)` for retries after failures. This spreads clients more as the outage continues, while preserving the backoff shape.

Use `Schedule.spaced(...).pipe(Schedule.jittered)` for polling. This keeps the average polling interval recognizable while avoiding a fleet-wide tick every exact interval.

Combine jitter with a hard limit. `Schedule.jittered` changes delays, not the reason a schedule stops. Pair it with `Schedule.recurs` for retry count limits or `Schedule.during` for elapsed-time budgets.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds successful values into the schedule. That distinction matters when adding predicates: retry policies usually inspect errors, while polling policies usually inspect returned statuses.

Jitter reduces accidental coordination; it does not provide fairness or rate limiting by itself. If the downstream system needs a strict cap, add a rate limiter or queue in front of the calls and keep jitter as the mechanism that prevents synchronized bursts.
