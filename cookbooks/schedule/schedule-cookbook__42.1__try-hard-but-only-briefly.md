---
book: Effect `Schedule` Cookbook
section_number: "42.1"
section_title: "“Try hard, but only briefly”"
part_title: "Part IX — Composition Recipes"
chapter_title: "42. Express Operational Intent Through Composition"
status: "draft"
code_included: true
---

# 42.1 “Try hard, but only briefly”

Some failures deserve a real effort, but not a long wait. A request can hit a
short restart, a just-rotated connection, or a cache entry that is about to
appear. In those cases, the useful policy is not "retry forever" or "retry once"
but "try a few quick times inside a tiny window, then give the caller the
failure."

Model that operational phrase as a composed schedule. One piece says how hard
to try, another says how brief the window is, and `Schedule.both` makes both
limits visible in the policy.

## Problem

You call a dependency that usually recovers quickly when it recovers at all. An
immediate failure should not be returned without a small retry burst, but the
caller should also not wait through a long backoff sequence.

The policy should answer three questions directly:

- how quickly to retry after a failure
- how many follow-up attempts are allowed
- how long the whole retry window may stay open

The first attempt still runs immediately. `Schedule` controls only the
decisions after a typed failure.

## When to use it

Use this recipe for cheap, idempotent operations where a short recovery window
is useful: reading from a local service, fetching small metadata, refreshing a
cache value, or calling an internal dependency during a deploy.

It is a good fit when "try hard" means several quick attempts, not minutes of
persistence. For example, `Schedule.recurs(4)` means up to four retries after
the original attempt, so the effect can execute at most five times total.

## When not to use it

Do not use this for permanent failures. Bad input, authorization failures,
missing resources, and rejected business rules should usually fail without a
retry policy.

Do not use it for expensive or unsafe operations unless the unit being retried
is idempotent. A short schedule can still repeat a side effect several times.

Also avoid this policy when the dependency is already overloaded. In that case,
"try hard" can make the outage worse; use a slower backoff policy with jitter
instead.

## Schedule shape

Compose a short fast cadence with a retry-count limit and an elapsed-time
budget:

```ts
Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(4)),
  Schedule.both(Schedule.during("500 millis"))
)
```

`Schedule.exponential("50 millis")` starts with a small delay and increases it
on each recurrence. `Schedule.recurs(4)` bounds the number of retries.
`Schedule.during("500 millis")` bounds the retry window.

`Schedule.both` gives intersection semantics: the combined schedule recurs only
while both sides still want to recur, and it uses the larger delay from the
pieces being combined. The result is a policy that tries quickly, stops by
count, and also stops when the short time budget is exhausted.

## Code

```ts
import { Effect, Schedule } from "effect"

type DependencyError = {
  readonly _tag: "DependencyUnavailable"
  readonly service: string
}

declare const readFromDependency: Effect.Effect<string, DependencyError>

const tryHardButBriefly = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(4)),
  Schedule.both(Schedule.during("500 millis"))
)

export const program = readFromDependency.pipe(
  Effect.retry(tryHardButBriefly)
)
```

`program` performs the first dependency read immediately. If it fails with
`DependencyUnavailable`, the retry policy starts with a 50 millisecond delay,
then grows from there, while the count limit and the 500 millisecond budget both
remain open. If either limit is exhausted, `Effect.retry` returns the last typed
failure.

## Variants

For an even tighter user-facing path, reduce the budget and the retry count:

```ts
const veryShortBurst = Schedule.exponential("25 millis").pipe(
  Schedule.both(Schedule.recurs(2)),
  Schedule.both(Schedule.during("150 millis"))
)
```

For a small background task where a brief recovery window is still acceptable,
increase the budget slightly but keep the policy visibly bounded:

```ts
const briefBackgroundRecovery = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(6)),
  Schedule.both(Schedule.during("2 seconds"))
)
```

If many clients or workers can hit the same dependency at once, add
`Schedule.jittered` after the basic cadence and limits are correct:

```ts
const fleetFriendlyBurst = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(4)),
  Schedule.both(Schedule.during("500 millis")),
  Schedule.jittered
)
```

## Notes and caveats

`Schedule.during` is checked at recurrence decision points. It does not
interrupt an in-flight dependency call. If one attempt also needs a hard
deadline, add a timeout to the effect being retried.

`Schedule.recurs` counts retries after the original attempt. With
`Schedule.recurs(4)`, the effect can run up to five times total.

`Effect.retry` feeds failures into the schedule. Classify permanent failures
before applying this policy, or use a schedule predicate when only some typed
errors are retryable.
