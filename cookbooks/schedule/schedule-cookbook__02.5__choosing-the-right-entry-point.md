---
book: Effect `Schedule` Cookbook
section_number: "2.5"
section_title: "Choosing the right entry point"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.5 Choosing the right entry point

The same `Schedule` value can often be passed to either `Effect.repeat` or
`Effect.retry`, so it is easy to choose based on the timing policy alone. That is the
wrong first question. This section keeps the focus on Effect's `Schedule` model:
recurrence is represented as data that decides whether another decision point exists,
which delay applies, and what output the policy contributes. That framing makes later
retry, repeat, and polling recipes easier to compose without hiding timing behavior
inside ad hoc loops.

## Problem

The same `Schedule` value can often be passed to either `Effect.repeat` or
`Effect.retry`, so it is easy to choose based on the timing policy alone. That
is the wrong first question. The entry point decides which value is fed into the
schedule and which event stops the process.

`Effect.repeat` is driven by success. The original effect runs once, and after
each success the schedule receives the successful value as input. If the effect
fails, repetition stops immediately and the failure is returned.

`Effect.retry` is driven by typed failure. The original effect runs once, and
after each typed failure the schedule receives the error as input. If the effect
succeeds, retrying stops immediately with the successful value. If the policy is
exhausted while the effect is still failing, the last failure is returned.

## When to use it

Use `Effect.repeat` when another run is a consequence of a successful result:
polling a job state, emitting a heartbeat, refreshing a cache, sampling a
metric, or continuing until a returned value satisfies a condition.

Use `Effect.retry` when another run is a consequence of a typed failure:
temporary network errors, rate limits modeled as errors, transient resource
unavailability, or domain errors that explicitly say the operation may be tried
again.

The practical test is:

| Question                                     | Entry point     |
| -------------------------------------------- | --------------- |
| Should the policy inspect successful values? | `Effect.repeat` |
| Should the policy inspect typed failures?    | `Effect.retry`  |
| Should the first failure stop the loop?      | `Effect.repeat` |
| Should the first success stop the loop?      | `Effect.retry`  |

## When not to use it

Do not choose `repeat` to recover from failures. `repeat` does not retry failed
effects; it propagates the first failure.

Do not choose `retry` for normal successful states. If `"pending"` is a valid
successful response from a job-status endpoint, model it as a success and repeat
until the status becomes ready. Failing with `"pending"` only so `retry` can see
it makes the error channel carry ordinary state.

Do not rely on `retry` for defects or interruptions. The `Effect.retry` source
docs specify that defects and interruptions are not retried as typed failures.

## Schedule shape

Both entry points accept the same broad policy shapes: an options object, a
`Schedule`, or a schedule builder.

Use the options form when the policy is local:

- `times` limits recurrences after the first execution.
- `while` continues while the observed value satisfies a predicate.
- `until` continues until the observed value satisfies a predicate.
- `schedule` adds an explicit schedule policy to those predicates.

The observed value depends on the entry point. In `repeat` options, `while` and
`until` inspect successful values. In `retry` options, they inspect typed
failures.

Use a named `Schedule` when the policy is reusable or composed from multiple
concerns. For example, exponential backoff plus a recurrence limit is usually
clearer as a named policy than as inline control flow.

Use the builder form when the schedule needs to inspect its input and you want
the input type inferred from the effect.

Return values are different. With the raw schedule overload,
`Effect.repeat(effect, schedule)` succeeds with the schedule output. With the
options form, `Effect.repeat({ ... })` keeps the repeated effect's final
successful value. `Effect.retry` succeeds with the original effect's successful
value; the retry policy output is not the success value of the retried effect.

## Code

When a successful value controls the next run, repeat:

```ts
import { Effect, Schedule } from "effect"

declare const readStatus: Effect.Effect<"starting" | "ready">

export const waitUntilReady = readStatus.pipe(
  Effect.repeat({
    schedule: Schedule.spaced("1 second"),
    until: (status) => status === "ready"
  })
)
```

Here `"starting"` is not a failure. It is a successful state that says the
polling loop should continue on the schedule. If `readStatus` fails, the repeat
stops with that failure.

When a typed failure controls the next run, retry:

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceError extends Data.TaggedError("ServiceError")<{
  readonly retryable: boolean
}> {}

declare const callService: Effect.Effect<string, ServiceError>

const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

export const callWithRetries = callService.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: (error) => error.retryable
  })
)
```

Here the policy sees `ServiceError` values. Retry continues only while the error
is retryable and the schedule has not been exhausted.

## Variants

For the smallest local policy, use `times`:

```ts
import { Data, Effect } from "effect"

class ServiceError extends Data.TaggedError("ServiceError")<{
  readonly retryable: boolean
}> {}

declare const readStatus: Effect.Effect<"starting" | "ready">
declare const callService: Effect.Effect<string, ServiceError>

const repeatThreeMoreTimes = readStatus.pipe(
  Effect.repeat({ times: 3 })
)

const retryThreeMoreTimes = callService.pipe(
  Effect.retry({ times: 3 })
)
```

In both cases, `times: 3` means up to three additional executions after the
first one.

For an input-sensitive schedule with good inference, use the builder form:

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceError extends Data.TaggedError("ServiceError")<{
  readonly retryable: boolean
}> {}

declare const callService: Effect.Effect<string, ServiceError>

const callRetryingOnlyRetryableErrors = callService.pipe(
  Effect.retry(($) =>
    $(Schedule.exponential("100 millis")).pipe(
      Schedule.while(({ input }) => input.retryable),
      Schedule.both(Schedule.recurs(3))
    )
  )
)
```

Use the same shape with `Effect.repeat` when the schedule needs to inspect
successful values instead of failures.

When exhaustion is part of the domain, use the recovery variants:
`Effect.repeatOrElse` for repetition that fails before completion, and
`Effect.retryOrElse` for retry policies that exhaust while the effect is still
failing.

## Notes and caveats

The first execution is not counted as a recurrence. `Schedule.recurs(3)` and
`times: 3` both allow up to three runs after the initial execution.

A timing schedule such as `Schedule.spaced("1 second")` can be unbounded. Pair
unbounded schedules with `times`, `Schedule.recurs`, `Schedule.take`, or a
predicate unless an endless loop until failure or interruption is intentional.

Keep the repeated or retried effect scoped to the work that is safe to run more
than once. This matters most for retries: if a larger workflow partially
succeeds before a later step fails, retrying the whole workflow may duplicate
side effects that already happened.
