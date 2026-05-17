---
book: "Effect `Schedule` Cookbook"
section_number: "14.1"
section_title: "Poll every second for up to 30 seconds"
part_title: "Part IV — Polling Recipes"
chapter_title: "14. Poll with Timeouts"
status: "draft"
code_included: true
---

# 14.1 Poll every second for up to 30 seconds

Use this for a short status poll: run the check once immediately, then keep
checking roughly once per second while the last successful status is still
pending. The schedule controls recurrence; ordinary Effect code interprets the
final status.

## Problem

The status endpoint can succeed with `"pending"`, `"ready"`, or `"failed"`.
Only `"pending"` should request another poll, and polling should stop once the
30-second recurrence budget is exhausted.

The budget is not a hard timeout for a request already in flight. It is checked
between successful status observations.

## When to use it

Use it for readiness checks, job-status endpoints, and eventually consistent
projections where "not ready yet" is a successful domain value.

## When not to use it

Do not use it to retry failed status requests. `Effect.repeat` stops when the
checked effect fails.

Do not rely on `Schedule.during("30 seconds")` to interrupt slow requests. Use
`Effect.timeout` on the status check, or around the whole workflow, when the
caller needs interruption semantics.

## Schedule shape

Use `Schedule.spaced("1 second")` for the cadence, `Schedule.while` for the
pending-status predicate, and `Schedule.during("30 seconds")` for the elapsed
recurrence budget. `Schedule.passthrough` keeps the latest status as the repeat
result instead of returning the timing schedule's numeric output.

## Example

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type Status =
  | { readonly state: "pending" }
  | { readonly state: "ready"; readonly resourceId: string }
  | { readonly state: "failed"; readonly reason: string }

const script: ReadonlyArray<Status> = [
  { state: "pending" },
  { state: "pending" },
  { state: "ready", resourceId: "resource-123" }
]

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
    Effect.repeat(pollEverySecondForUpTo30Seconds),
    Effect.forkDetach
  )

  yield* TestClock.adjust("30 seconds")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The example uses `TestClock` so it can run in `scratchpad/repro.ts` without
waiting for real seconds. The policy itself still uses a one-second interval and
a 30-second recurrence budget.

## Variants

Apply `Effect.timeout("2 seconds")` to `checkStatus` when each individual
request needs its own deadline. That timeout can interrupt the request; the
schedule still only decides whether to poll again after a successful response.

Use `Schedule.fixed("1 second")` instead of `Schedule.spaced("1 second")` when
polls should target wall-clock boundaries rather than waiting one second after
each completed check.

## Notes and caveats

The first check is immediate. `Schedule.during` is approximate for the whole
workflow because it is consulted between successful checks. `Schedule.while`
sees successful status values only, so transport and decoding failures remain in
the effect failure channel.
