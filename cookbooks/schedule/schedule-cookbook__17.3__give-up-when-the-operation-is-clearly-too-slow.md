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

Use this when continuing to poll is no longer useful after a practical elapsed
budget. The operation may still finish later, but this caller should stop
waiting and make that outcome explicit.

## Problem

A status check can keep succeeding with `"pending"`. The schedule should stop
polling after a budget even when no terminal status has appeared, and it should
still stop earlier for `"ready"` or `"failed"`.

## When to use it

Use it when slowness is a domain or operational outcome, not a transport
failure. This fits user-facing waits, orchestration steps, readiness checks, and
integrations where continued polling would waste capacity.

## When not to use it

Do not use it as a hard interruption timeout. `Schedule.during` is evaluated
between successful status checks; it does not cancel a status check already in
flight.

Do not collapse a domain `"failed"` status and a slow `"pending"` status into
the same case unless the caller truly handles them the same way. They usually
mean different things operationally.

## Schedule shape

Use a spaced cadence, preserve the latest successful status with
`Schedule.passthrough`, continue only while that status is `"pending"`, and
combine the policy with `Schedule.during` to cap the recurrence window.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type OperationStatus =
  | { readonly state: "pending"; readonly operationId: string }
  | { readonly state: "ready"; readonly operationId: string; readonly resourceId: string }
  | { readonly state: "failed"; readonly operationId: string; readonly reason: string }

const giveUpWhenTooSlow = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<OperationStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("8 seconds").pipe(
      Schedule.satisfiesInputType<OperationStatus>()
    )
  )
)

let checks = 0

const checkOperationStatus = Effect.gen(function*() {
  const now = yield* Clock.currentTimeMillis
  checks += 1

  const status: OperationStatus = {
    state: "pending",
    operationId: "operation-1"
  }

  console.log(`t+${now}ms check ${checks}: ${status.state}`)
  return status
})

const program = Effect.gen(function*() {
  const fiber = yield* checkOperationStatus.pipe(
    Effect.repeat(giveUpWhenTooSlow),
    Effect.forkDetach
  )

  yield* TestClock.adjust("12 seconds")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The final status is still `"pending"`, which is the signal that the schedule
stopped because the operation was too slow for this caller.

## Variants

If each check needs its own deadline, apply `Effect.timeout("3 seconds")` to the
checked effect. That can interrupt an in-flight check; the schedule cannot.

If the caller needs a typed timeout error, inspect the final status after
`Effect.repeat` and map final `"pending"` to a domain error. Section 17.5 shows
that shape.

Use `Schedule.fixed("2 seconds")` instead of `Schedule.spaced("2 seconds")`
when the polling loop should target fixed wall-clock boundaries rather than
waiting two seconds after each successful check completes.

## Notes and caveats

The first check is immediate. The duration budget is approximate for the whole
workflow because it is checked between successful runs. Failed status-check
effects do not become schedule inputs.
