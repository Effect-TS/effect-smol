---
book: Effect `Schedule` Cookbook
section_number: "34.5"
section_title: "Making retry behavior explicit"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.5 Making retry behavior explicit

Retry behavior belongs in named `Schedule` values so traffic, wait time, and
retry budgets are reviewable at the policy boundary.

## Problem

You need retry behavior that can be reviewed without reading a loop body or
reverse-engineering a chain of anonymous schedule operators.

The first execution still happens normally. The schedule describes only the
follow-up decisions after that first failure: whether another retry is allowed
and how long to wait before it runs.

## When to use it

Use this recipe when retry behavior is part of the contract for a service
boundary, queue consumer, startup check, or background worker. It is especially
useful when the values may be tuned during incidents or reviewed in a pull
request.

Good candidates include transient network failures, rate-limited dependency
calls, reconnect loops, and startup checks where retrying is expected but must
remain bounded.

## When not to use it

Do not use a retry schedule to make permanent errors look transient.
Validation failures, malformed requests, invalid credentials, and unsafe
non-idempotent writes should be classified before retry is applied.

Also do not hide retry policy inside a helper whose name says only
`withRetry`. If the retry behavior matters, the helper or local schedule should
say what it promises: `retryFiveTimesWithBackoff`,
`retryWithinStartupBudget`, or `retryWithJitteredBackoff`.

## Schedule shape

Build the policy out of small named pieces:

```ts
import { Schedule } from "effect"

const retryCadence = Schedule.exponential("200 millis")
const retryLimit = Schedule.recurs(5)
const retryBudget = Schedule.during("10 seconds")

const retryPolicy = retryCadence.pipe(
  Schedule.both(retryLimit),
  Schedule.both(retryBudget)
)
```

`Schedule.exponential("200 millis")` describes the delay pattern. With the
default factor, the delays grow as 200 milliseconds, 400 milliseconds, 800
milliseconds, and so on.

`Schedule.recurs(5)` permits up to five scheduled recurrences. With
`Effect.retry`, that means up to five retries after the original failed
attempt, not five total attempts.

`Schedule.during("10 seconds")` keeps the schedule active only while its elapsed
duration is within the budget.

`Schedule.both` gives intersection semantics: both schedules must want to
continue. It also uses the maximum of their delays. In practice, that means a
combined retry policy stops as soon as any named guard is exhausted.

## Code

```ts
import { Effect, Schedule } from "effect"

type TransientError = {
  readonly _tag: "Timeout" | "Unavailable" | "RateLimited"
}

declare const callDownstream: Effect.Effect<string, TransientError>

const retryCadence = Schedule.exponential("200 millis")
const retryLimit = Schedule.recurs(5)
const retryBudget = Schedule.during("10 seconds")

const retryPolicy = retryCadence.pipe(
  Schedule.both(retryLimit),
  Schedule.both(retryBudget)
)

export const program = callDownstream.pipe(
  Effect.retry(retryPolicy)
)
```

This policy says:

- start with exponential backoff from 200 milliseconds
- allow at most five retries after the original failed call
- stop once the retry schedule has been active for more than 10 seconds

The names are deliberately plain. In code review, a change from
`Schedule.recurs(5)` to `Schedule.recurs(20)` now appears as a change to
`retryLimit`, not as a small number inside an opaque expression.

## Variants

For a short user-facing path, make the count and latency budget obvious:

```ts
const userFacingRetryCadence = Schedule.spaced("100 millis")
const userFacingRetryLimit = Schedule.recurs(2)

const userFacingRetryPolicy = userFacingRetryCadence.pipe(
  Schedule.both(userFacingRetryLimit)
)
```

This allows the original call plus at most two retries, each separated by 100
milliseconds.

For many concurrent callers, name the jittered cadence separately:

```ts
const dependencyBackoff = Schedule.exponential("250 millis")
const jitteredDependencyBackoff = Schedule.jittered(dependencyBackoff)
const dependencyRetryLimit = Schedule.recurs(6)

const dependencyRetryPolicy = jitteredDependencyBackoff.pipe(
  Schedule.both(dependencyRetryLimit)
)
```

`Schedule.jittered` randomly adjusts each recurrence delay between 80% and 120%
of the original delay. Keeping it in the name helps explain why logs and metrics
will not show identical retry intervals.

For a two-phase policy, make the phases visible instead of burying them:

```ts
const quickRetries = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)
const slowerRetries = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(2))
)

const phasedRetryPolicy = Schedule.andThen(quickRetries, slowerRetries)
```

`Schedule.andThen` runs the left schedule first, then switches to the right
schedule. This is useful when the first few retries should be fast, but later
retries should put less pressure on the dependency.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same schedule can therefore observe
different input depending on which combinator drives it.

Prefer names that describe behavior, not implementation. `exponential` says
which constructor was used. `retryPaymentAuthorizationWithJitteredBackoff`
says what operational behavior the policy is supposed to provide.

Keep classification close to the effect being retried. The schedule should
describe recurrence mechanics: cadence, count, elapsed budget, jitter, phases,
and observation. It should not be responsible for deciding that a validation
error is secretly retryable.
