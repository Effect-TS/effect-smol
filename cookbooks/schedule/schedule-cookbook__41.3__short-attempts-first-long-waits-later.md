---
book: Effect `Schedule` Cookbook
section_number: "41.3"
section_title: "Short attempts first, long waits later"
part_title: "Part IX — Composition Recipes"
chapter_title: "41. Build Multi-Phase Policies"
status: "draft"
code_included: true
---

# 41.3 Short attempts first, long waits later

Some failures and pending states are most likely to clear quickly. A cache entry
may appear a few hundred milliseconds later, a just-started job may finish soon,
or a remote dependency may recover after a small network hiccup. In those cases,
use a short responsive phase first, then a more patient phase if the operation
is still not ready.

Use `Schedule.andThen` to model that handoff directly. The first schedule runs
until it is exhausted. Only then does the second schedule start making
recurrence decisions.

## Problem

Build one schedule value with two named phases so reviewers can see the handoff
from a short responsive window to a longer patient window.

## When to use it

Use this recipe when early responsiveness matters, but sustained aggressive
retrying or polling would create noise or load. It fits status polling after a
user-triggered workflow, dependency checks during startup, reconnect attempts,
and retryable calls where the first few failures are often transient.

This policy is also useful when operators need to answer two separate questions:
how hard the system tries at first, and how conservative it becomes later.

## When not to use it

Do not use a longer second phase to disguise a permanent failure. Validation
errors, authorization failures, malformed requests, and unsafe non-idempotent
writes should be classified before retrying.

For polling, prefer a callback, queue notification, or direct completion signal
when the producer can send one reliably. A schedule is a good fit when the
consumer must observe state over time.

## Schedule shape

Build the policy as two named phases. For example, a quick phase can allow a
few recurrences at short spacing, then a patient phase can allow fewer, slower
recurrences. With `Effect.retry`, the original attempt still runs immediately;
the schedule controls only the waits before retry attempts.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type TransientError = {
  readonly _tag: "TransientError"
  readonly message: string
}

let attempts = 0

const fetchFromDependency = Effect.gen(function*() {
  attempts++
  yield* Console.log(`dependency attempt ${attempts}`)

  if (attempts <= 4) {
    return yield* Effect.fail({
      _tag: "TransientError",
      message: `not ready ${attempts}`
    } satisfies TransientError)
  }

  return `value returned on attempt ${attempts}`
})

const quickRetries = Schedule.spaced("20 millis").pipe(
  Schedule.take(3)
)

const slowRetries = Schedule.spaced("80 millis").pipe(
  Schedule.take(4)
)

const retryQuicklyThenSlowly = Schedule.andThen(quickRetries, slowRetries)

const program = fetchFromDependency.pipe(
  Effect.retry(retryQuicklyThenSlowly),
  Effect.flatMap((value) => Console.log(value))
)

Effect.runPromise(program)
```

The quick phase handles the first few follow-up attempts. If the dependency is
still failing, the slower phase takes over without changing the retrying code.

## Variants

Add `Schedule.jittered` to each phase when many clients may run the same policy
at the same time. Jitter randomizes each delay slightly and reduces synchronized
retries.

Use `Schedule.andThenResult` instead of `Schedule.andThen` when you need to
observe which phase produced each schedule output. The left phase is represented
as a `Result` failure and the right phase as a `Result` success, which is useful
for phase-specific logging or metrics.

## Notes and caveats

`Schedule.andThen` sequences policies; it does not run both phases at once. If
you need a cadence plus a separate limit at the same time, combine schedules
with operators such as `Schedule.both` instead.

`Schedule.take(n)` limits recurrences made by that phase. It does not count the
initial run of the effect before `Effect.retry` or `Effect.repeat` starts using
the schedule.

Schedules control recurrence decisions and delays. They do not shorten the
duration of an individual attempt. If each request needs its own timeout, apply
that timeout to the effect being retried or repeated, then use the schedule for
the phase-based waits between attempts.
