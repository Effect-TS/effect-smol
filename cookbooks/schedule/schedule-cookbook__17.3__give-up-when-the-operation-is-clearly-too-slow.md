---
book: Effect `Schedule` Cookbook
section_number: "17.3"
section_title: "Give up when the operation is clearly too slow"
part_title: "Part IV — Polling Recipes"
chapter_title: "17. Poll with a Timeout"
status: "draft"
code_included: true
---

# 17.3 Give up when the operation is clearly too slow

Use this recipe when continued polling stops being useful after an operation
has exceeded a practical elapsed-time budget. The schedule bounds recurrence;
surrounding Effect code interprets whether the last status is ready, failed, or
simply too slow.

## Problem

The status endpoint still returns successful domain values such as `"pending"`,
`"ready"`, and `"failed"`. The schedule should stop asking for another status
check once the polling budget is exhausted, while still stopping earlier if a
terminal status is observed.

## When to use it

Use this when slowness is an operational decision, not a transport failure. The
operation may still finish later, but the current caller should stop polling and
move on after a practical time budget.

This is a good fit for user-facing flows, background orchestration steps,
readiness checks, and integrations where continued polling would waste capacity
or hold a request open longer than the caller can usefully wait.

## When not to use it

Do not use a schedule duration limit as a hard interruption timeout.
`Schedule.during("45 seconds")` is evaluated at recurrence decision points
after successful status checks. It decides whether to schedule another poll; it
does not interrupt a status check that is already running.

Do not use this as a retry policy for failed status checks. With
`Effect.repeat`, a failure from the checked effect stops the repeat immediately.
Retry transport or decoding failures separately if they should be retried.

Do not collapse a domain `"failed"` status and a slow `"pending"` status into
the same case unless the caller truly handles them the same way. They usually
mean different things operationally.

## Schedule shape

Combine a polling cadence, a status predicate, and an elapsed recurrence budget:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<OperationStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("45 seconds").pipe(
      Schedule.satisfiesInputType<OperationStatus>()
    )
  )
)
```

`Schedule.spaced("2 seconds")` waits between successful status checks.
`Schedule.while` allows another recurrence only while the latest successful
status is still pending. `Schedule.during("45 seconds")` closes the recurrence
window after the elapsed budget is used up.

`Schedule.passthrough` keeps the latest successful status as the schedule
output, and `Schedule.bothLeft` preserves that output after adding the elapsed
budget.

## Code

```ts
import { Effect, Schedule } from "effect"

type OperationStatus =
  | { readonly state: "pending"; readonly operationId: string }
  | { readonly state: "ready"; readonly operationId: string; readonly resourceId: string }
  | { readonly state: "failed"; readonly operationId: string; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

declare const checkOperationStatus: (
  operationId: string
) => Effect.Effect<OperationStatus, StatusCheckError>

const giveUpWhenTooSlow = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<OperationStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("45 seconds").pipe(
      Schedule.satisfiesInputType<OperationStatus>()
    )
  )
)

const pollUntilReadyOrTooSlow = (operationId: string) =>
  checkOperationStatus(operationId).pipe(
    Effect.repeat(giveUpWhenTooSlow)
  )
```

`pollUntilReadyOrTooSlow` performs the first status check immediately. If the
operation is already `"ready"` or `"failed"`, polling stops without another
request. If the status is `"pending"`, the schedule waits two seconds before
checking again while the 45-second recurrence budget still allows another poll.

The returned effect succeeds with the final observed `OperationStatus`. That
value may be terminal, or it may be the last `"pending"` value observed when
the schedule decided the operation was too slow to keep polling.

## Variants

If each status check also needs its own hard request deadline, put a timeout on
the checked effect:

```ts
const pollUntilReadyOrTooSlowWithRequestTimeout = (operationId: string) =>
  checkOperationStatus(operationId).pipe(
    Effect.timeout("3 seconds"),
    Effect.repeat(giveUpWhenTooSlow)
  )
```

This timeout can interrupt an in-flight status check. The schedule still
controls only the two-second polling cadence and the 45-second recurrence
budget.

If the caller needs to distinguish "terminal" from "gave up while still
pending", inspect the final successful status after `Effect.repeat` completes.
A final `"pending"` value means the schedule stopped recurrence before a
terminal state was observed.

Use `Schedule.fixed("2 seconds")` instead of `Schedule.spaced("2 seconds")`
when the polling loop should target fixed wall-clock boundaries rather than
waiting two seconds after each successful check completes.

## Notes and caveats

The first status check is not delayed. The schedule controls recurrences after
the first successful run.

The duration budget is approximate for the whole polling workflow because it is
checked between successful runs. Time spent inside status checks contributes to
elapsed schedule time before the next recurrence decision, but the schedule
does not cancel a check that is already running.

`Schedule.while` sees successful status values only. Failed status-check
effects do not become schedule inputs.

When a timing schedule reads `metadata.input`, constrain the schedule with
`Schedule.satisfiesInputType<T>()` before `Schedule.while`.
