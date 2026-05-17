---
book: Effect `Schedule` Cookbook
section_number: "17.2"
section_title: "Poll every 5 seconds for up to 2 minutes"
part_title: "Part IV — Polling Recipes"
chapter_title: "17. Poll with a Timeout"
status: "draft"
code_included: true
---

# 17.2 Poll every 5 seconds for up to 2 minutes

Use this recipe for a status endpoint that may need several checks before it
reaches a terminal state, but should not keep the caller waiting indefinitely.
The schedule owns cadence and stopping; surrounding Effect code interprets the
final status.

## Problem

The status check itself is an effect whose successful result may still be
non-terminal. After a successful non-terminal status, wait five seconds and
check again while the two-minute recurrence budget is still open.

## When to use it

Use this when polling is driven by successful status values and the caller wants
a practical upper bound on how long the repeat loop remains open.

This is a good fit for job, export, provisioning, indexing, or payment-status
checks where a non-terminal status is an ordinary successful response.

## When not to use it

Do not use this to retry a failing status endpoint by itself. With
`Effect.repeat`, a failure from the status-check effect stops the repeat
immediately. Apply retry to the status check separately when transport or
decoding failures should be retried.

Do not treat the schedule-side two-minute budget as an interruption timeout for
an in-flight status check. `Schedule.during("2 minutes")` is consulted at
recurrence decision points after successful checks; it does not cancel a check
that is already running.

Do not use this when every individual request needs its own hard deadline
unless you also apply `Effect.timeout` to the status-check effect.

## Schedule shape

Combine a five-second cadence, a two-minute elapsed recurrence budget, and a
status predicate:

```ts
Schedule.spaced("5 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("2 minutes").pipe(Schedule.satisfiesInputType<Status>())
  )
)
```

`Schedule.spaced("5 seconds")` supplies the delay before each recurrence.
`Schedule.during("2 minutes")` supplies the elapsed recurrence budget.
`Schedule.while` stops when a terminal status is observed.
`Schedule.passthrough` keeps the latest successful status as the schedule
output, so the repeated effect returns the final observed status.

## Code

```ts
import { Effect, Schedule } from "effect"

type Status =
  | { readonly state: "pending"; readonly requestId: string }
  | { readonly state: "complete"; readonly requestId: string; readonly resultId: string }
  | { readonly state: "failed"; readonly requestId: string; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isPending = (status: Status): boolean => status.state === "pending"

declare const checkStatus: (
  requestId: string
) => Effect.Effect<Status, StatusCheckError>

const pollEvery5SecondsForUpTo2Minutes = Schedule.spaced("5 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isPending(input)),
  Schedule.bothLeft(
    Schedule.during("2 minutes").pipe(Schedule.satisfiesInputType<Status>())
  )
)

const pollStatus = (requestId: string) =>
  checkStatus(requestId).pipe(
    Effect.repeat(pollEvery5SecondsForUpTo2Minutes)
  )
```

`pollStatus` performs the first status check immediately. If that first
successful observation is terminal, the schedule stops without another request.
If the status is still `"pending"`, the schedule waits five seconds before the
next check, and keeps doing that while the two-minute recurrence budget allows
another recurrence.

The returned effect succeeds with the final observed `Status`. That value may
be terminal, or it may be the last `"pending"` status observed when the
schedule-side budget stopped the repeat.

## Variants

If each status check also needs a hard per-request timeout, put the timeout on
the checked effect, not only on the schedule:

```ts
const pollStatusWithPerCheckTimeout = (requestId: string) =>
  checkStatus(requestId).pipe(
    Effect.timeout("3 seconds"),
    Effect.repeat(pollEvery5SecondsForUpTo2Minutes)
  )
```

That changes the behavior of an individual in-flight check. The schedule still
controls only the five-second recurrence cadence and the two-minute recurrence
budget.

Use `Schedule.fixed("5 seconds")` instead of `Schedule.spaced("5 seconds")`
when the polling cadence should target fixed five-second boundaries rather than
waiting five seconds after each successful status check completes.

## Notes and caveats

The first status check is not delayed. The schedule controls recurrences after
the first successful check.

The two-minute duration is approximate for the whole polling workflow because
the schedule budget is checked between successful runs. Time spent inside
status checks contributes to elapsed schedule time before the next recurrence
decision, but the schedule does not interrupt an in-flight check.

`Schedule.while` sees successful status values. It does not inspect effect
failures from `checkStatus`.

When reading `metadata.input` from a timing schedule, use
`Schedule.satisfiesInputType<T>()` before `Schedule.while` so the input type is
explicit.
