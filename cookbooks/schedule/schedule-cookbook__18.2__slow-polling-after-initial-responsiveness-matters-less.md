---
book: Effect `Schedule` Cookbook
section_number: "18.2"
section_title: "Slow polling after initial responsiveness matters less"
part_title: "Part IV — Polling Recipes"
chapter_title: "18. Poll Aggressively at First, Then Slow Down"
status: "draft"
code_included: true
---

# 18.2 Slow polling after initial responsiveness matters less

Use this recipe for the slower phase after an initial responsive polling window
has already passed. The goal is to keep observing progress without continuing
the early high-frequency cadence.

## Problem

At this point, continuing to poll every few hundred milliseconds mostly creates
load. The polling policy should switch to a slower cadence while still stopping
as soon as a terminal status is observed.

## When to use it

Use this when the first responsive phase has passed and the remaining work is
allowed to settle over tens of seconds or minutes.

This is a good fit for exports, media processing, provisioning, indexing,
settlement checks, and other workflows where early completion is nice, but
later completion does not need instant feedback.

## When not to use it

Do not use this as the whole initial user-facing policy when the first few
seconds are important. The first status check still runs immediately, but the
slow interval controls subsequent recurrences.

Do not use this when an external system requires a minimum or maximum polling
contract that differs from your chosen interval.

Do not use this to retry a failing status endpoint by itself. With
`Effect.repeat`, failed effects stop the repeat. The schedule only sees
successful status values.

## Schedule shape

Use a slower spacing interval, preserve the latest successful status, and
continue only while that status is still non-terminal:

```ts
Schedule.spaced("30 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending")
)
```

`Schedule.spaced("30 seconds")` supplies the steady slower cadence after each
successful pending observation. `Schedule.while` stops when a terminal status is
observed. `Schedule.passthrough` keeps the latest status as the schedule output,
so the repeated effect returns the final observed status from this slower
polling phase.

## Code

```ts
import { Effect, Schedule } from "effect"

type Status =
  | { readonly state: "pending"; readonly progress: number }
  | { readonly state: "ready"; readonly resultId: string }
  | { readonly state: "failed"; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isPending = (status: Status): boolean => status.state === "pending"

declare const checkStatus: (
  workflowId: string
) => Effect.Effect<Status, StatusCheckError>

const slowPollingAfterInitialWindow = Schedule.spaced("30 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isPending(input))
)

const pollSlowly = (workflowId: string) =>
  checkStatus(workflowId).pipe(
    Effect.repeat(slowPollingAfterInitialWindow)
  )
```

`pollSlowly` performs a status check immediately when this slower phase starts.
If that observation is terminal, it stops without waiting. If the status is
still `"pending"`, the schedule waits 30 seconds before checking again.

The returned effect succeeds with the latest observed `Status`. That value may
be terminal, or it may still be `"pending"` if this slower phase is combined
with another stopping condition elsewhere.

## Variants

Use a shorter interval, such as 10 or 15 seconds, when the user is still
watching the page and a small delay in completion feedback would be noticeable.

Use a longer interval, such as one or five minutes, when the workflow is mostly
background work and the status endpoint is expensive or rate limited.

Add jitter when many clients may enter the slow phase at roughly the same time.
The slower cadence reduces load, but it does not by itself prevent synchronized
polling.

Add a separate cap or elapsed-time budget when the caller needs a definite
answer instead of an open-ended slow wait.

## Notes and caveats

The first check in this slower phase is not delayed. `Effect.repeat` runs the
effect once before consulting the schedule for recurrences.

`Schedule.spaced` waits after each successful status check completes. Use it
when the pause between completed checks matters more than aligning to
wall-clock boundaries.

`Schedule.while` sees successful status values. Transport, authorization, or
decoding failures should stay in the effect failure channel and be retried or
reported separately.

When a timing schedule reads `metadata.input`, constrain the schedule with
`Schedule.satisfiesInputType<Status>()` before `Schedule.while`.
