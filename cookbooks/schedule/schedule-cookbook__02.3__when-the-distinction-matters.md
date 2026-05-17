---
book: "Effect `Schedule` Cookbook"
section_number: "2.3"
section_title: "When the distinction matters"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.3 When the distinction matters

`Effect.repeat` and `Effect.retry` both accept schedules, but they feed different
values to those schedules. The entry point is a semantic choice, not just a
timing choice.

## Problem

A value-sensitive policy only sees the channel selected by the entry point.
Polling states belong on the success path. Transient service errors belong on
the failure path. If the operator is wrong, the schedule may never see the value
you meant to inspect.

## Comparison

| Question                                 | `Effect.repeat`                                 | `Effect.retry`                      |
| ---------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| What triggers the schedule?              | A successful value                              | A typed failure                     |
| What does the schedule receive as input? | The success value                               | The error value                     |
| What stops immediately?                  | The first failure                               | The first success                   |
| What happens when the schedule stops?    | Repetition completes after the last success     | Retry fails with the last error     |
| What does `times: n` mean?               | Up to `n` repetitions after the first run       | Up to `n` retries after first run   |

The same real-world workflow can use either operator depending on how the result
is modeled.

## Code

This program uses `repeat` for successful job states and `retry` for transient
service failures:

```ts
import { Console, Data, Effect, Schedule } from "effect"

type JobState = "pending" | "ready"

let polls = 0

const checkJob = Effect.sync((): JobState => {
  polls += 1
  return polls < 3 ? "pending" : "ready"
}).pipe(
  Effect.tap((state) => Console.log(`job state: ${state}`))
)

class ReportError extends Data.TaggedError("ReportError")<{
  readonly kind: "Unavailable" | "Unauthorized"
}> {}

let attempts = 0

const fetchReport = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`report attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail(new ReportError({ kind: "Unavailable" }))
  }

  return "report"
})

const retryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const program = Effect.gen(function*() {
  const finalState = yield* checkJob.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("10 millis"),
      until: (state) => state === "ready"
    })
  )
  yield* Console.log(`repeat finished with: ${finalState}`)

  const report = yield* fetchReport.pipe(
    Effect.retry({
      schedule: retryPolicy,
      while: (error) => error.kind === "Unavailable"
    })
  )
  yield* Console.log(`retry finished with: ${report}`)
})

Effect.runPromise(program)
```

`"pending"` is a successful value, so the polling loop repeats. `"Unavailable"`
is a typed failure, so the request retries.

## Tradeoffs

`repeat` keeps normal domain states in the success channel. That is a good fit
for polling, heartbeats, refresh loops, and workflows where a successful
observation decides whether to continue. The tradeoff is that the first failure
stops the repeat unless the repeated effect handles it.

`retry` keeps transient inability to complete the operation in the error
channel. That is a good fit for requests, reconnect attempts, and resource
contention. The tradeoff is that success ends the retry immediately.

## Recommended default

Put expected domain states in the success channel and repeat over them. Put
temporary inability to complete the operation in the error channel and retry over
it.

If you find yourself failing with normal states only so `retry` can see them, or
turning real failures into successful values only so `repeat` can see them, the
model is probably carrying the wrong information in the wrong channel.

Both operators run the effect once before the schedule makes a recurrence
decision. `times: 3` therefore means the initial execution plus up to three more
executions.
