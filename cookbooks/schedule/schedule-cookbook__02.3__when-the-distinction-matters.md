---
book: Effect `Schedule` Cookbook
section_number: "2.3"
section_title: "When the distinction matters"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.3 When the distinction matters

You have an effect that may need to run more than once, and both `Effect.repeat` and
`Effect.retry` accept schedules. The question is not only which timing policy to use.
This section keeps the focus on Effect's `Schedule` model: recurrence is represented as
data that decides whether another decision point exists, which delay applies, and what
output the policy contributes. That framing makes later retry, repeat, and polling
recipes easier to compose without hiding timing behavior inside ad hoc loops.

## Problem

A value-sensitive policy only sees the channel selected by the entry point. A
polling state belongs on the success path, while a transient service error
belongs on the failure path.

Use the wrong operator and the schedule may never see the value you meant to
inspect.

## Why this comparison matters

The distinction decides what the schedule receives as input, what stops the
loop, and what the composed effect returns when the loop is done.

| Question                                 | `Effect.repeat`                                 | `Effect.retry`                            |
| ---------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| What triggers the schedule?              | A successful value                              | A typed failure                           |
| What does the schedule receive as input? | The success value                               | The error value                           |
| What stops immediately?                  | The first failure                               | The first success                         |
| What happens when the schedule stops?    | The repetition completes after the last success | The retry fails with the last error       |
| What does `times: n` mean?               | Run once, then repeat up to `n` more times      | Try once, then retry up to `n` more times |

This means the same real-world operation can need either operator depending on
how you model the result.

## Option 1

Use `Effect.repeat` when the effect has succeeded and the successful value tells
you whether another run is needed.

Polling is the common shape. A job that returns `"pending"` is not failing; it
is reporting a successful state that is not finished yet.

```ts
import { Effect, Schedule } from "effect"

declare const checkJob: Effect.Effect<"pending" | "ready">

// The job state is a successful value, so the schedule is driven by successes.
export const waitForReady = checkJob.pipe(
  Effect.repeat({
    schedule: Schedule.spaced("1 second"),
    until: (state) => state === "ready"
  })
)
```

If `checkJob` fails, repetition stops and that failure is returned. The repeat
policy is only consulted after a success.

## Option 2

Use `Effect.retry` when the effect has failed with a typed error and that error
tells you whether another attempt is appropriate.

Transient failures such as rate limits or temporary unavailability belong in
this shape. A successful report stops retrying immediately.

```ts
import { Effect, Schedule } from "effect"

declare const fetchReport: Effect.Effect<
  string,
  "RateLimited" | "Unavailable" | "Unauthorized"
>

// The transient conditions are typed failures, so the schedule is driven by errors.
export const fetchReportWithRetry = fetchReport.pipe(
  Effect.retry({
    schedule: Schedule.exponential("100 millis").pipe(
      Schedule.both(Schedule.recurs(5))
    ),
    while: (error) => error === "RateLimited" || error === "Unavailable"
  })
)
```

If `fetchReport` succeeds, retrying stops. If it keeps failing after the
schedule is exhausted, the last failure is returned.

## Tradeoffs

`repeat` keeps normal domain states in the success channel. That makes it a good
fit for polling, heartbeats, refresh loops, and workflows where success means
"do it again later." The tradeoff is that it does not recover from failure; a
failure stops the repeat.

`retry` keeps transient inability to complete the operation in the error channel.
That makes it a good fit for network requests, reconnect attempts, and other
operations where failure may be temporary. The tradeoff is that it does nothing
after success; a successful value is returned immediately.

## Recommended default

A useful rule of thumb is: put domain states you expect to observe in the success
channel and repeat over them; put transient inability to complete the operation
in the error channel and retry over it.

## Notes and caveats

If you find yourself converting errors into success values only so `repeat` can
see them, or failing with normal states only so `retry` can see them, the model
is probably doing extra work.

Both operators run the effect once before the schedule can make a recurrence
decision. `times: 3` therefore means the initial run plus up to three more runs:
three repetitions for `repeat`, or three retries for `retry`.
