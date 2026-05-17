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

Use this when the status endpoint may take several observations to reach a
terminal state, but the caller should not wait indefinitely. The schedule owns
the five-second cadence and the two-minute recurrence budget.

## Problem

A successful status check can still report `"pending"`. After each successful
pending observation, wait five seconds and check again while the two-minute
recurrence budget remains open.

## When to use it

Use it for exports, provisioning, indexing, payment settlement, and other
workflows where a non-terminal status is an ordinary successful response.

## When not to use it

Do not use it as a retry policy for failed requests. With `Effect.repeat`, the
first failure from the checked effect stops the repeat.

Do not treat `Schedule.during("2 minutes")` as a request timeout. It limits
future recurrences after successful checks; it does not cancel an in-flight
request.

## Schedule shape

Combine `Schedule.spaced("5 seconds")`, `Schedule.while` over the latest status,
and `Schedule.during("2 minutes")`. Add `Schedule.passthrough` so
`Effect.repeat` returns the final observed status.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type Status =
  | { readonly state: "pending"; readonly requestId: string }
  | { readonly state: "complete"; readonly requestId: string; readonly resultId: string }
  | { readonly state: "failed"; readonly requestId: string; readonly reason: string }

const isPending = (status: Status): boolean => status.state === "pending"

const pollEvery5SecondsForUpTo2Minutes = Schedule.spaced("5 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isPending(input)),
  Schedule.bothLeft(
    Schedule.during("2 minutes").pipe(Schedule.satisfiesInputType<Status>())
  )
)

const script: ReadonlyArray<Status> = [
  { state: "pending", requestId: "export-1" },
  { state: "pending", requestId: "export-1" },
  { state: "complete", requestId: "export-1", resultId: "file-9" }
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
    Effect.repeat(pollEvery5SecondsForUpTo2Minutes),
    Effect.forkDetach
  )

  yield* TestClock.adjust("2 minutes")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

`TestClock` makes the scratchpad example finish immediately while preserving the
five-second and two-minute values in the schedule.

## Variants

Apply `Effect.timeout("3 seconds")` to the checked effect when an individual
status request needs a hard deadline.

Use `Schedule.fixed("5 seconds")` instead of `Schedule.spaced("5 seconds")`
when the polling cadence should target fixed five-second boundaries rather than
waiting five seconds after each successful status check completes.

## Notes and caveats

The first status check is immediate. Time spent inside status checks contributes
to elapsed schedule time, but `Schedule.during` is still checked only between
successful observations. `Schedule.while` does not inspect effect failures.
