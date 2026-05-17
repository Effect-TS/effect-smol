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

An external API might fail immediately during one incident and slowly during
another. The policy should bound both cases by elapsed recurrence time without
guessing how many attempts will fit into that window.

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

Start with the cadence, add `Schedule.during`, and compose them with
`Schedule.both`. `Schedule.both` continues only while both schedules continue.
The cadence supplies the retry delay. The `Schedule.during` side supplies the
elapsed recurrence window. Add `Schedule.recurs` only when you also need a hard
recurrence cap.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type ServiceUnavailable = {
  readonly _tag: "ServiceUnavailable"
  readonly status: number
}

const responses: ReadonlyArray<number | "ok"> = [503, 503, 429, "ok"]
let attempts = 0

const fetchConfiguration: Effect.Effect<string, ServiceUnavailable> = Effect.gen(function*() {
  const index = yield* Effect.sync(() => {
    const current = attempts
    attempts += 1
    return current
  })
  const response = responses[index] ?? 503

  yield* Console.log(`configuration attempt ${index + 1}: ${response}`)

  if (response === "ok") {
    return "feature flags loaded"
  }

  return yield* Effect.fail({
    _tag: "ServiceUnavailable",
    status: response
  })
})

const productionRetryBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(10))
)

const program = fetchConfiguration.pipe(
  Effect.retry({
    schedule: productionRetryBudget,
    while: (error) => error.status === 429 || error.status >= 500
  }),
  Effect.flatMap((result) => Console.log(result)),
  Effect.catch((error) =>
    Console.log(`stopped on status ${error.status} after ${attempts} attempts`)
  )
)

Effect.runPromise(program)
```

`fetchConfiguration` runs once immediately. If it fails with a retryable
`ServiceUnavailable`, the schedule retries with exponential backoff while the
30-second elapsed budget remains open. If an attempt succeeds, `program`
succeeds with the configuration. If the budget closes first, `program` fails
with the last typed error.

## Variants

For a steady background operation, use fixed spacing inside the budget. This
keeps the load profile predictable. For a user-facing path, keep the budget
short so transient failures get a brief recovery window without making the
caller wait through a long retry policy.

Combine time and count when the time budget is primary but you still want
protection against very fast failures consuming too many attempts.

## Notes and caveats

Budget-based limits are not attempt-count limits. A 30-second budget does not
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
