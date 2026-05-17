---
book: "Effect `Schedule` Cookbook"
section_number: "15.1"
section_title: "Fast polling during the first few seconds"
part_title: "Part IV — Polling Recipes"
chapter_title: "15. Adaptive and Fleet-Safe Polling"
status: "draft"
code_included: true
---

# 15.1 Fast polling during the first few seconds

Use this for workflows that often settle quickly. The schedule gives the caller
a short responsive burst without making fast polling the steady-state policy.

## Problem

Early completion is common, so waiting through a large interval would feel
unnecessarily slow. The fast cadence should still be bounded, because a
permanent tight loop creates load without adding much value.

## When to use it

Use this when early completion is common and a fresh result is valuable enough
to justify a short burst of extra requests.

This fits status checks that often move from `"pending"` to `"ready"` shortly
after submission.

## When not to use it

Do not use this as an unbounded polling loop. Fast polling is most useful as an
initial burst, not as the steady-state cadence for long-running work.

Do not use this to retry a failing status check by itself. With
`Effect.repeat`, failed effects stop the repeat. The schedule only sees
successful status values.

Do not use a very small interval when each status check is expensive, rate
limited, or likely to queue behind earlier requests.

## Schedule shape

Use `Schedule.spaced("250 millis")` for the burst cadence, `Schedule.take(12)`
to cap the burst, `Schedule.while` to continue only for pending statuses, and
`Schedule.passthrough` to return the latest status.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type Status =
  | { readonly state: "pending" }
  | { readonly state: "ready"; readonly resourceId: string }
  | { readonly state: "failed"; readonly reason: string }

const fastInitialPolling = Schedule.spaced("250 millis").pipe(
  Schedule.take(12),
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending")
)

const script: ReadonlyArray<Status> = [
  { state: "pending" },
  { state: "pending" },
  { state: "ready", resourceId: "result-1" }
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
    Effect.repeat(fastInitialPolling),
    Effect.forkDetach
  )

  yield* TestClock.adjust("3 seconds")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The first check is immediate. The 250-millisecond delay applies only after a
successful pending observation.

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

`Schedule.take(12)` limits recurrences after the initial check. It is not a
workflow timeout and it does not interrupt an in-flight request. `Schedule.while`
sees successful status values only.
