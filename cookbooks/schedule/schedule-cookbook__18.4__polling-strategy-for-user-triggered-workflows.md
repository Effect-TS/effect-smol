---
book: Effect `Schedule` Cookbook
section_number: "18.4"
section_title: "Polling strategy for user-triggered workflows"
part_title: "Part IV — Polling Recipes"
chapter_title: "18. Poll Aggressively at First, Then Slow Down"
status: "draft"
code_included: true
---

# 18.4 Polling strategy for user-triggered workflows

Use this recipe for work started by a user action, such as generating a report,
submitting a review, importing a small file, refreshing derived data, or
starting an approval flow. The schedule starts responsive, then slows down if
the workflow is still processing.

## Problem

The first few seconds are important because the user is still watching. If the
workflow finishes quickly, the UI should notice quickly. If it does not finish
quickly, polling should slow down so the status endpoint is not kept under
unnecessary pressure.

## When to use it

Use this when the workflow is user-triggered, visible to the caller, and often
settles shortly after submission.

This is a good fit for pages that can update from `"processing"` to `"ready"`
without requiring the user to refresh, while still tolerating a slower cadence
after the initial responsive window.

## When not to use it

Do not use this as a general policy for long-running back-office jobs. Those
usually need wider intervals, operational budgets, and separate alerting or
handoff behavior.

Do not use this when the status endpoint itself is expensive enough that even a
short burst would compete with the workflow being observed.

Do not use this to retry failed status requests by itself. With
`Effect.repeat`, failed effects stop the repeat. The schedule sees successful
status values.

## Schedule shape

Sequence a short responsive phase into a slower follow-up phase, preserve the
latest status, and stop when a terminal status is observed:

```ts
Schedule.spaced("500 millis").pipe(
  Schedule.take(8),
  Schedule.andThen(Schedule.spaced("5 seconds")),
  Schedule.satisfiesInputType<WorkflowStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "processing")
)
```

The immediate first status check is performed by `Effect.repeat` before the
schedule controls any recurrence. After that, the schedule polls every 500
milliseconds for a small number of recurrences, then switches to a five-second
cadence.

`Schedule.while` stops both phases when the latest successful status is no
longer `"processing"`. `Schedule.passthrough` makes the repeated effect return
the latest observed `WorkflowStatus` instead of the timing schedule's numeric
output.

## Code

```ts
import { Effect, Schedule } from "effect"

type WorkflowStatus =
  | { readonly state: "processing"; readonly message: string }
  | { readonly state: "ready"; readonly resultUrl: string }
  | { readonly state: "failed"; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

declare const checkWorkflowStatus: (
  workflowId: string
) => Effect.Effect<WorkflowStatus, StatusCheckError>

const userTriggeredPolling = Schedule.spaced("500 millis").pipe(
  Schedule.take(8),
  Schedule.andThen(Schedule.spaced("5 seconds")),
  Schedule.satisfiesInputType<WorkflowStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "processing")
)

const pollUserTriggeredWorkflow = (workflowId: string) =>
  checkWorkflowStatus(workflowId).pipe(
    Effect.repeat(userTriggeredPolling)
  )
```

If the first status check returns `"ready"` or `"failed"`, the effect returns
without waiting. If it returns `"processing"`, polling starts with the fast
phase and then continues at the slower cadence until a terminal status is
observed.

The returned value is the latest successful `WorkflowStatus`. Domain failure
reported as `{ state: "failed" }` is a terminal status value; transport,
authorization, or decoding failures remain in the effect failure channel.

## Variants

Use a shorter fast phase for lightweight UI actions where most completions
happen almost immediately. For example, four recurrences at 300 milliseconds
keeps the responsive window brief.

Use a slower follow-up interval when the user can leave the page open while the
workflow continues. Ten or fifteen seconds is often enough for a visible UI
flow that no longer needs near-instant feedback.

Add jitter to the slower phase when many users may trigger the same workflow at
the same time, such as after a deploy, notification, or scheduled campaign.

Add a separate cap or elapsed-time budget when the UI must eventually stop
waiting and tell the user to check back later.

## Notes and caveats

`Schedule.take(8)` limits only the fast recurrence phase. It does not include
the initial status check, and it does not limit the slower phase after
`Schedule.andThen`.

Apply the status predicate after `Schedule.andThen` so terminal statuses stop
the whole policy, not only the fast phase.

Keep the status check cheap and read-only. User-triggered polling should
observe progress, not perform the work again.

When a timing schedule reads `metadata.input`, constrain the schedule with
`Schedule.satisfiesInputType<WorkflowStatus>()` before `Schedule.while`.
