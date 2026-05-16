---
book: Effect `Schedule` Cookbook
section_number: "35.4"
section_title: "Use budget-based limits in production"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "35. Stop After a Time Budget"
status: "draft"
code_included: true
---

# 35.4 Use budget-based limits in production

Production retry and polling policies usually need a budget, not just a
counter. A fixed attempt count answers "how many more times may this run?" A
time budget answers "how long may this workflow keep consuming capacity?"

Use `Schedule.during` when the operational limit is elapsed schedule time.
Compose it with the cadence or backoff schedule so the policy shows both parts:
how long to wait between recurrences and when the recurrence window closes.

## Problem

You need a production policy that stops after a bounded window without guessing
how many attempts will fit into that window. A fast failure might produce many
retries. A slow failure might produce only a few. Both should stay inside the
same operational budget.

The schedule should make this visible in one place:

- the delay shape, such as fixed spacing or exponential backoff
- the elapsed budget, such as 30 seconds or 5 minutes
- any optional count cap that protects against unusually fast recurrences

## When to use it

Use this recipe for production retries, reconnects, status polling, cache
refreshes, and background repair loops where the important promise is "try
within this window" rather than "try exactly this many times."

It is especially useful when attempt duration is not stable. Network calls,
queue operations, database failovers, and external APIs can fail immediately in
one incident and slowly in another. A budget-based policy keeps the service
behavior bounded across both cases.

## When not to use it

Do not use a schedule budget as a hard timeout for a single attempt.
`Schedule.during` is checked when the schedule is consulted after an attempt
finishes. It does not interrupt work already in progress.

Do not use a time budget to hide permanent failures. Invalid input,
authorization failures, malformed requests, and unsafe non-idempotent writes
should be classified before retrying.

Do not use `Schedule.during` by itself for production retry loops. It has no
meaningful delay of its own, so a fast-failing effect can run repeatedly until
the budget closes. Pair it with `Schedule.spaced`, `Schedule.exponential`, or
another cadence.

## Schedule shape

Start with the cadence:

```ts
const cadence = Schedule.exponential("200 millis")
```

Then add the budget:

```ts
const budget = Schedule.during("30 seconds")
```

Compose them with `Schedule.both`:

```ts
const retryWithinBudget = cadence.pipe(
  Schedule.both(budget)
)
```

`Schedule.both` continues only while both schedules continue. The exponential
side supplies the retry delay. The `Schedule.during("30 seconds")` side supplies
the elapsed recurrence window. When either side stops, the composed schedule
stops.

Add `Schedule.recurs` only when you also need a hard recurrence cap:

```ts
const retryWithinBudgetAndCount = cadence.pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(12))
)
```

Read that as "retry with this delay while the 30 second budget is open and no
more than 12 retries have been scheduled."

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly status: number
}> {}

declare const fetchConfiguration: Effect.Effect<string, ServiceUnavailable>

const productionRetryBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

export const program = fetchConfiguration.pipe(
  Effect.retry({
    schedule: productionRetryBudget,
    while: (error) => error.status === 429 || error.status >= 500
  })
)
```

`fetchConfiguration` runs once immediately. If it fails with a retryable
`ServiceUnavailable`, the schedule retries with exponential backoff while the
30 second elapsed budget remains open. If an attempt succeeds, `program`
succeeds with the configuration. If the budget closes first, `program` fails
with the last typed error.

## Variants

For a steady background operation, use fixed spacing inside the budget:

```ts
const steadyProductionBudget = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("2 minutes"))
)
```

This keeps the load profile predictable and stops after the elapsed window
closes.

For a user-facing path, keep the budget short:

```ts
const interactiveBudget = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.during("2 seconds"))
)
```

This gives transient failures a brief recovery window without making the caller
wait through a long retry policy.

For a production safety cap, combine time and count:

```ts
const boundedProductionRetry = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(10))
)
```

This is useful when the time budget is the primary constraint, but you still
want protection against very fast failures consuming too many attempts.

## Notes and caveats

Budget-based limits are not attempt-count limits. A 30 second budget does not
mean 30 retries, even with a one second cadence, because each attempt takes time
and the schedule is consulted between attempts.

`Schedule.during(duration)` recurs while the schedule elapsed time is within
the supplied duration. It outputs the elapsed duration, but plain
`Effect.retry` uses the schedule for timing and stopping; the success value is
still the value produced by the retried effect.

`Effect.retry` feeds typed failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same budget idea works for both, but
the operational meaning is different: retries spend budget after failures,
while repeats spend budget after successful iterations.

Keep domain classification close to the effect. Use retry predicates or typed
error modeling to decide which failures are retryable, then let `Schedule`
describe recurrence mechanics: cadence, elapsed budget, count caps, and
optional jitter.
