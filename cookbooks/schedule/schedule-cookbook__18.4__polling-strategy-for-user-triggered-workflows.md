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
starting an approval flow. Poll quickly while the user is likely watching, then
slow down if the workflow is still processing.

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

Use `Schedule.andThen` to sequence a short responsive phase into a slower
follow-up phase. Put `Schedule.while` after the sequencing so terminal statuses
stop both phases, and use `Schedule.passthrough` to return the latest
`WorkflowStatus`.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type WorkflowStatus =
  | { readonly state: "processing"; readonly message: string }
  | { readonly state: "ready"; readonly resultUrl: string }
  | { readonly state: "failed"; readonly reason: string }

const userTriggeredPolling = Schedule.spaced("500 millis").pipe(
  Schedule.take(4),
  Schedule.andThen(Schedule.spaced("5 seconds")),
  Schedule.satisfiesInputType<WorkflowStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "processing")
)

const script: ReadonlyArray<WorkflowStatus> = [
  { state: "processing", message: "queued" },
  { state: "processing", message: "rendering" },
  { state: "processing", message: "uploading" },
  { state: "processing", message: "still uploading" },
  { state: "processing", message: "almost done" },
  { state: "ready", resultUrl: "/reports/42" }
]

let checks = 0

const checkWorkflowStatus = Effect.gen(function*() {
  const now = yield* Clock.currentTimeMillis
  const status = script[Math.min(checks, script.length - 1)]!
  checks += 1
  console.log(`t+${now}ms check ${checks}: ${status.state}`)
  return status
})

const program = Effect.gen(function*() {
  const fiber = yield* checkWorkflowStatus.pipe(
    Effect.repeat(userTriggeredPolling),
    Effect.forkDetach
  )

  yield* TestClock.adjust("10 seconds")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The first check is immediate. The first four scheduled recurrences use the
500-millisecond cadence; the next recurrence uses the five-second cadence.

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

`Schedule.take(4)` limits only the fast recurrence phase. It does not include
the initial status check, and it does not limit the slower phase after
`Schedule.andThen`.

Apply the status predicate after `Schedule.andThen` so terminal statuses stop
the whole policy, not only the fast phase.

Keep the status check cheap and read-only. User-triggered polling should
observe progress, not perform the work again.

Request failures stay in the effect failure channel. `Schedule.while` sees only
successful status values.
