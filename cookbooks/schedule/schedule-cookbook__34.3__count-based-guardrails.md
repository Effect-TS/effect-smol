---
book: Effect `Schedule` Cookbook
section_number: "34.3"
section_title: "Count-based guardrails"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.3 Count-based guardrails

Count limits are operational guardrails. They keep a retry, repeat, or polling
policy from spending unbounded work when the real completion condition never
arrives.

In Effect, the usual count guard is `Schedule.recurs(n)`. It does not run the
effect by itself and it does not count the original execution. It limits how
many scheduled recurrences may happen after that first execution.

That distinction is the whole point of using it as a guardrail:

- with `Effect.retry`, `Schedule.recurs(5)` permits up to five retries after the
  original failed attempt
- with `Effect.repeat`, `Schedule.recurs(5)` permits up to five repeated
  executions after the original successful execution

## Problem

You need a policy that can be explained without reading the loop body:

- how long the workflow waits between attempts
- how many follow-up attempts are allowed
- what happens when the count is exhausted

The count should be visible at the schedule boundary, not hidden in a mutable
counter or a hand-written recursive function.

## When to use it

Use a count guard when the number of follow-up executions is itself an
operational requirement. For example, a user-facing request may allow only a few
retry attempts before returning the last error, while a background worker may be
allowed more attempts but still needs an upper bound.

It is also useful as a secondary limit on a richer timing policy. Backoff,
spacing, and jitter describe when to try again. `Schedule.recurs` describes how
many more chances the workflow gets.

## When not to use it

Do not use a count limit as a latency budget. Three retries can finish quickly
when failures are immediate, or take a long time when each attempt waits on a
slow dependency before failing. If the requirement is "try for no more than 10
seconds", use a time budget such as `Schedule.during`.

Do not use retries to hide permanent failures. Bad input, invalid credentials,
authorization failures, and unsafe non-idempotent writes should be classified
before the retry policy is applied.

## Schedule shape

Start with the cadence, then add the count guard:

```ts
import { Schedule } from "effect"

const policy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

`Schedule.exponential("200 millis")` controls the delay between attempts.
`Schedule.recurs(5)` limits the number of scheduled recurrences. `Schedule.both`
requires both schedules to continue, so the combined policy stops when the
count is exhausted.

The count is a recurrence count, not a total execution count:

- `Schedule.recurs(0)` allows no follow-up executions
- `Schedule.recurs(1)` allows one follow-up execution
- `Schedule.recurs(5)` allows five follow-up executions

## Code

```ts
import { Effect, Schedule } from "effect"

type TransientError = {
  readonly _tag: "Timeout" | "Unavailable" | "RateLimited"
}

declare const callDownstream: Effect.Effect<string, TransientError>

const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

export const program = callDownstream.pipe(
  Effect.retry(retryPolicy)
)
```

The first call to `callDownstream` happens before the schedule is consulted. If
that call fails with a typed `TransientError`, the retry policy decides whether
another attempt is allowed and how long to wait first.

With this policy, the operation can run at most six times total: one original
attempt plus five scheduled retries. If all allowed retries fail, `Effect.retry`
propagates the last typed failure.

## Variants

For a fixed delay, keep the same count guard and change only the cadence:

```ts
const fixedRetryPolicy = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(3))
)
```

For a repeated maintenance step, the same count rule applies to successful
executions:

```ts
declare const refreshOneBatch: Effect.Effect<void>

export const refreshProgram = refreshOneBatch.pipe(
  Effect.repeat(Schedule.spaced("5 seconds").pipe(
    Schedule.both(Schedule.recurs(10))
  ))
)
```

Here the first batch refresh runs normally. After each successful refresh, the
schedule may allow up to ten more refreshes, spaced five seconds apart.

For service-boundary retries, a count is often only one guardrail. Add elapsed
time when callers care about the retry window:

```ts
const boundedRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(10)),
  Schedule.both(Schedule.during("10 seconds"))
)
```

This policy stops when either the retry count is exhausted or the schedule has
been active for more than the time budget.

## Notes and caveats

`Schedule.recurs(n)` returns a `Schedule<number>`. Its output is the zero-based
recurrence count. Most retry and repeat programs ignore that output, but it can
be useful for logging with `Schedule.tapOutput`.

`Effect.retry` feeds typed failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same count guard therefore limits
different events depending on which combinator drives it.

The most common mistake is off by one. If an external requirement says "try the
operation three times total", the schedule guard is `Schedule.recurs(2)`, not
`Schedule.recurs(3)`.
