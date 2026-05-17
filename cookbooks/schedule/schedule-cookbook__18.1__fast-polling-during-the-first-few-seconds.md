---
book: Effect `Schedule` Cookbook
section_number: "18.1"
section_title: "Fast polling during the first few seconds"
part_title: "Part IV — Polling Recipes"
chapter_title: "18. Poll Aggressively at First, Then Slow Down"
status: "draft"
code_included: true
---

# 18.1 Fast polling during the first few seconds

Use this recipe for workflows that usually settle within a few seconds, where
an immediate answer is valuable but a permanent fast loop would be wasteful.
The schedule models only the short initial burst.

## Problem

You want to poll aggressively at the beginning so users do not wait through a
large fixed interval when the answer is probably already available. At the same
time, the aggressive cadence should be bounded so it does not become the whole
polling policy.

## When to use it

Use this when early completion is common and a fresh result is valuable enough
to justify a short burst of extra requests.

This is a good fit for status checks that often move from `"pending"` to
`"ready"` within the first one to three seconds after submission.

## When not to use it

Do not use this as an unbounded polling loop. Fast polling is most useful as an
initial burst, not as the steady-state cadence for long-running work.

Do not use this to retry a failing status check by itself. With
`Effect.repeat`, failed effects stop the repeat. The schedule only sees
successful status values.

Do not use a very small interval when each status check is expensive, rate
limited, or likely to queue behind earlier requests.

## Schedule shape

Use a short spacing interval, cap the number of fast recurrences, preserve the
latest successful status, and continue only while the status is still
non-terminal:

```ts
Schedule.spaced("250 millis").pipe(
  Schedule.take(12),
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending")
)
```

`Schedule.spaced("250 millis")` waits briefly after each successful pending
observation. `Schedule.take(12)` bounds the fast burst to a small number of
recurrences. `Schedule.while` stops as soon as a terminal status is observed.
`Schedule.passthrough` keeps the latest status as the schedule output, so the
repeated effect returns the final observed status from the burst.

## Code

```ts
import { Effect, Schedule } from "effect"

type Status =
  | { readonly state: "pending" }
  | { readonly state: "ready"; readonly resourceId: string }
  | { readonly state: "failed"; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

declare const checkStatus: (
  workflowId: string
) => Effect.Effect<Status, StatusCheckError>

const fastInitialPolling = Schedule.spaced("250 millis").pipe(
  Schedule.take(12),
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending")
)

const pollDuringFastWindow = (workflowId: string) =>
  checkStatus(workflowId).pipe(
    Effect.repeat(fastInitialPolling)
  )
```

The first `checkStatus` call runs immediately. If it returns `"ready"` or
`"failed"`, polling stops without waiting. If it returns `"pending"`, the
schedule waits 250 milliseconds before the next check and keeps doing that only
for the bounded fast window.

The resulting effect succeeds with the latest observed `Status`. That status
may be terminal, or it may still be `"pending"` if the fast burst is exhausted
before the workflow completes.

## Variants

Use a smaller recurrence cap when the first few checks usually settle the
workflow. For example, five recurrences at 200 milliseconds keeps the aggressive
window close to one second after the immediate first check.

Use a larger interval when requests are heavier or the remote service publishes
status updates less frequently. A 500 millisecond burst can still feel
responsive without creating as much request pressure.

Use `Schedule.fixed("250 millis")` instead of `Schedule.spaced("250 millis")`
only when you want to target fixed wall-clock boundaries. For most status
endpoints, `Schedule.spaced` is simpler because it waits after each completed
check.

## Notes and caveats

The first status check is not delayed. `Effect.repeat` runs the effect once
before consulting the schedule for recurrences.

The recurrence cap limits the aggressive burst. It is not a whole-workflow
timeout and it does not interrupt an in-flight status check.

`Schedule.while` reads successful status values. Transport, authorization, or
decoding failures should remain in the effect failure channel and be handled
separately if they should be retried.

When a timing schedule reads `metadata.input`, constrain the schedule with
`Schedule.satisfiesInputType<Status>()` before `Schedule.while`.
