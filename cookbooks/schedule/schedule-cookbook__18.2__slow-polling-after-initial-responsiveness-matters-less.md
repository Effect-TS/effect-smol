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

Use this for the slower phase after the initial responsive window has passed.
The caller still observes progress, but the status endpoint is no longer polled
at the early high-frequency cadence.

## Problem

After the first few seconds, polling every few hundred milliseconds usually
creates load without improving the user experience. The policy should slow down
and still stop as soon as a terminal status appears.

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

Use `Schedule.spaced("30 seconds")` for the slower cadence,
`Schedule.passthrough` to keep the latest status as the result, and
`Schedule.while` to continue only while that status is still pending.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type Status =
  | { readonly state: "pending"; readonly progress: number }
  | { readonly state: "ready"; readonly resultId: string }
  | { readonly state: "failed"; readonly reason: string }

const isPending = (status: Status): boolean => status.state === "pending"

const slowPollingAfterInitialWindow = Schedule.spaced("30 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isPending(input))
)

const script: ReadonlyArray<Status> = [
  { state: "pending", progress: 70 },
  { state: "ready", resultId: "report-42" }
]

let checks = 0

const checkStatus = Effect.gen(function*() {
  const now = yield* Clock.currentTimeMillis
  const status = script[Math.min(checks, script.length - 1)]!
  checks += 1
  console.log(`t+${now}ms check ${checks}: ${status.state}`)
  return status
})

const program = Effect.gen(function*() {
  const fiber = yield* checkStatus.pipe(
    Effect.repeat(slowPollingAfterInitialWindow),
    Effect.forkDetach
  )

  yield* TestClock.adjust("30 seconds")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

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

The first check in this phase is immediate. `Schedule.spaced` waits after each
successful status check completes. `Schedule.while` sees successful status
values only; request failures should be retried or reported separately.
