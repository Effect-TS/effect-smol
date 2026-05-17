---
book: Effect `Schedule` Cookbook
section_number: "17.1"
section_title: "Poll every second for up to 30 seconds"
part_title: "Part IV — Polling Recipes"
chapter_title: "17. Poll with a Timeout"
status: "draft"
code_included: true
---

# 17.1 Poll every second for up to 30 seconds

You need a short, bounded polling loop: check once immediately, then continue
about once per second while the status is still pending. This recipe keeps
cadence and stop conditions in the schedule and leaves status interpretation to
surrounding Effect code.

## Problem

The status endpoint returns domain states as successful values. For example,
`"pending"` means "poll again", while `"ready"` or `"failed"` means "stop
polling". Transport, decoding, or authorization problems still belong in the
effect failure channel.

## When to use it

Use this when the polling loop is driven by successful status observations and
the caller wants a bounded wait for a terminal state.

This is a good fit for readiness checks, job-status endpoints, eventually
consistent projections, and external APIs where "not ready yet" is a normal
successful response.

## When not to use it

Do not use this to retry a failing status check. `Effect.repeat` repeats after
success; if the status-check effect fails, the repeat stops with that failure.

Do not treat `Schedule.during("30 seconds")` as a hard timeout for an in-flight
status check. Schedule-side duration limits are evaluated at recurrence
decision points, after successful observations. They decide whether to schedule
another poll; they do not interrupt a status check that is already running.

Do not use this when the caller must fail exactly at 30 seconds. Add an
operation-level or whole-program timeout separately when strict interruption is
part of the contract.

## Schedule shape

Combine a one-second cadence, a status predicate, and a schedule-side elapsed
budget:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("30 seconds").pipe(
      Schedule.satisfiesInputType<Status>()
    )
  )
)
```

`Schedule.spaced("1 second")` supplies the delay before each recurrence.
`Schedule.while` allows another recurrence only while the latest successful
status is still pending. `Schedule.during("30 seconds")` keeps the recurrence
window bounded by elapsed schedule time.

`Schedule.passthrough` keeps the latest successful status as the schedule
output, and `Schedule.bothLeft` preserves that output after adding the elapsed
budget.

## Code

```ts
import { Effect, Schedule } from "effect"

type Status =
  | { readonly state: "pending" }
  | { readonly state: "ready"; readonly resourceId: string }
  | { readonly state: "failed"; readonly reason: string }

type StatusError = {
  readonly _tag: "StatusError"
  readonly message: string
}

declare const checkStatus: Effect.Effect<Status, StatusError>

const pollEverySecondForUpTo30Seconds = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("30 seconds").pipe(
      Schedule.satisfiesInputType<Status>()
    )
  )
)

const finalOrLastObservedStatus = checkStatus.pipe(
  Effect.repeat(pollEverySecondForUpTo30Seconds)
)
```

`checkStatus` runs once immediately. If it succeeds with `"ready"` or
`"failed"`, polling stops without waiting. If it succeeds with `"pending"`, the
schedule waits one second and checks again while the 30-second recurrence budget
is still open.

The resulting effect succeeds with the final observed `Status`. That value may
be terminal, or it may be the last `"pending"` value observed when the schedule
budget stopped allowing further recurrences.

## Variants

When each individual status check also needs a hard duration limit, apply
`Effect.timeout` to the status check itself:

```ts
const boundedCheckStatus = checkStatus.pipe(
  Effect.timeout("2 seconds")
)

const finalStatusWithPerCheckTimeout = boundedCheckStatus.pipe(
  Effect.repeat(pollEverySecondForUpTo30Seconds)
)
```

This timeout applies to each in-flight status check. The schedule still governs
only whether another recurrence should be scheduled after a successful check.

If the service should be polled on a fixed one-second wall-clock cadence rather
than one second after each status check completes, use `Schedule.fixed("1 second")`
in place of `Schedule.spaced("1 second")`. Keep the same status predicate and
elapsed budget.

## Notes and caveats

The first status check is not delayed. The schedule controls recurrences after
the first successful run.

`Schedule.during("30 seconds")` measures elapsed schedule time and participates
in recurrence decisions. It is a recurrence budget, not an interrupting timeout.

`Schedule.while` sees successful status values only. Failed status-check effects
do not become schedule inputs.

When a timing schedule reads status values through `metadata.input`, constrain
the schedule with `Schedule.satisfiesInputType<Status>()` before the predicate.
