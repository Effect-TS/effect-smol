---
book: Effect `Schedule` Cookbook
section_number: "2.1"
section_title: "Repeating successful effects"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.1 Repeating successful effects

You have an effect that represents one successful unit of work, and a successful run
should be followed by another run. The next run might happen immediately, after a delay,
a fixed number of times, or until the successful value says the loop is finished. This
section keeps the focus on Effect's `Schedule` model: recurrence is represented as data
that decides whether another decision point exists, which delay applies, and what output
the policy contributes. That framing makes later retry, repeat, and polling recipes
easier to compose without hiding timing behavior inside ad hoc loops.

## Problem

You have an effect that represents one successful unit of work, and a successful
run should be followed by another run. The next run might happen immediately,
after a delay, a fixed number of times, or until the successful value says the
loop is finished.

Without `Schedule`, that logic is easy to hide inside manual loops and sleeps.
With `Effect.repeat`, the effect stays focused on the work and the schedule
describes the recurrence policy.

## When to use it

Use `Effect.repeat` when success means "consider doing this again." Common
examples include heartbeats, periodic cache refreshes, metric sampling, polling
for a domain state, and repeating a successful setup check a bounded number of
times.

`repeat` is also the right fit when the value you need to inspect is in the
success channel. For example, a job state such as `"pending"` is often a normal
successful response, not a failure. In that model, repeat the successful polling
effect until the returned state is ready.

## When not to use it

Do not use `repeat` to recover from a failed effect. If the effect fails,
repetition stops immediately and the failure is returned. The schedule is only
consulted after a success.

Use `Effect.retry` when the next run should be triggered by a typed failure. Use
plain effect composition when you only need to run a sequence once and no
successful result should cause another run.

## Schedule shape

For `Effect.repeat`, each successful value becomes the schedule input. The
effect runs once before the schedule makes any decision. After that first
success, the schedule decides whether to continue and how long to wait before
the next recurrence.

`Schedule.recurs(n)` allows up to `n` recurrences after the first run.
`Schedule.spaced(duration)` recurs indefinitely with that delay between
successful runs. Combine an unbounded timing schedule with a bound such as
`Schedule.take(n)` when you need a finite recipe.

The return value depends on the overload. Passing a raw schedule returns the
schedule's final output. Using the options form, such as
`Effect.repeat({ times: n })` or `Effect.repeat({ schedule })`, returns the
repeated effect's final successful value.

## Code

This heartbeat runs once immediately, then repeats twice more with five seconds
between successful runs:

```ts
import { Console, Effect, Schedule } from "effect"

const heartbeat = Console.log("heartbeat")

const program = heartbeat.pipe(
  Effect.repeat(Schedule.spaced("5 seconds").pipe(Schedule.take(2)))
)
```

The initial execution is not counted as a scheduled recurrence. The schedule
controls what happens after each success.

For polling, keep the domain state in the success channel and stop with
`until`:

```ts
import { Effect, Schedule } from "effect"

type JobState = {
  readonly status: "pending" | "ready"
}

declare const readJobState: Effect.Effect<JobState, "network">

const waitForReady = readJobState.pipe(
  Effect.repeat({
    schedule: Schedule.spaced("1 second").pipe(Schedule.take(30)),
    until: (state) => state.status === "ready"
  })
)
```

The predicate is checked after a successful read. If `readJobState` fails,
`waitForReady` fails with that error instead of repeating.

## Variants

Use `times` for the smallest bounded repeat when you care about the final
successful value:

```ts
import { Effect } from "effect"

const readStatus = Effect.succeed({ ready: true, version: 1 })

const status = readStatus.pipe(
  Effect.repeat({ times: 2 })
)
```

Use a raw schedule when you care about the policy output. For example,
`Schedule.recurs(2)` outputs a number, so the repeated program succeeds with the
final recurrence count:

```ts
import { Console, Effect, Schedule } from "effect"

const repeated: Effect.Effect<number> = Console.log("sync complete").pipe(
  Effect.repeat(Schedule.recurs(2))
)
```

Use `while` instead of `until` when the predicate reads more naturally as the
condition for continuing. Both predicates inspect successful values when used
with `repeat`.

## Notes and caveats

`repeat` can run forever if the schedule is unbounded and the effect keeps
succeeding. That is useful for long-lived fibers such as heartbeats, but for a
one-shot workflow you usually want an explicit bound.

Delays are schedule delays between recurrences. They do not delay the initial
execution.

When you combine `until` with a bounded schedule, the repeat can also complete
because the schedule is exhausted. In that case the options form still returns
the last successful value, so make sure the caller can distinguish "ready" from
"stopped before ready" when that matters.

If the schedule itself can fail, that failure is part of the returned effect's
error channel. Basic schedules such as `Schedule.recurs` and `Schedule.spaced`
do not add their own error.
