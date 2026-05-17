---
book: Effect `Schedule` Cookbook
section_number: "30.5"
section_title: "Smooth demand over time"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "30. Space Requests Intentionally"
status: "draft"
code_included: true
---

# 30.5 Smooth demand over time

Use `Schedule.spaced` and, when needed, `Schedule.jittered` to turn repeated
work into a paced stream with visible timing rules.

## Problem

Queue draining, cache warming, search indexing, and remote API calls can create
uneven pressure when they run as quickly as possible: an idle period, then a
burst of requests, then another idle period.

The schedule should make each worker's pace explicit, and a fleet should avoid
synchronized requests when instances share the same configuration.

## When to use it

Use this recipe for background loops where each repetition is safe and useful on
its own, but bursty demand would hurt a downstream service, database, queue, or
cache.

It is especially useful when several process instances run the same loop. A
shared one-second spacing gives every instance the same average pace, while
jitter gives each instance a slightly different actual delay on each recurrence.

## When not to use it

Do not use spacing and jitter as a substitute for real concurrency limits, queue
backpressure, rate-limit handling, or overload protection. A schedule controls
when the next repetition is attempted; it does not know how much work is waiting
or how much capacity the downstream system currently has.

Do not add jitter when exact wall-clock cadence matters, such as emitting a
sample exactly on a reporting boundary. In that case, choose a precise cadence
deliberately and accept that it may align across workers.

## Schedule shape

`Schedule.spaced("1 second")` waits one second after each successful repetition
before the next repetition is started. This differs from `Schedule.fixed`, which
tries to maintain a wall-clock interval and may run immediately if the previous
action took longer than the interval.

`Schedule.jittered` adjusts each computed delay between `80%` and `120%` of the
original delay. Applied to a one-second spaced schedule, each sleep is randomly
chosen between 800 milliseconds and 1.2 seconds. The average pace stays close to
the base spacing, but instances no longer line up perfectly.

## Code

```ts
import { Effect, Schedule } from "effect"

type WorkItem = {
  readonly id: string
}

type WorkerError = {
  readonly _tag: "WorkerError"
}

declare const processNextItem: Effect.Effect<WorkItem, WorkerError>

const smoothedDemand = Schedule.spaced("1 second").pipe(
  Schedule.jittered,
  Schedule.take(100)
)

export const program = processNextItem.pipe(
  Effect.repeat(smoothedDemand)
)
```

The first `processNextItem` run happens immediately. The schedule controls only
the follow-up repetitions. Each successful run is followed by a jittered delay
around one second, and `Schedule.take(100)` bounds the number of scheduled
repetitions.

## Variants

For a single worker where only local pacing matters, remove `Schedule.jittered`
and keep the spacing deterministic.

For a larger fleet, keep the jitter even when the base interval is short. The
spacing controls average demand; the jitter reduces alignment between instances.

For long-running workers, replace `Schedule.take(100)` with a lifecycle boundary
outside the schedule, such as the fiber, queue, or service lifetime that owns the
loop. Keep the spacing policy named so operators can still see the intended
load profile.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. If
`processNextItem` fails, the repeat stops unless you handle or retry that error
separately.

`Schedule.spaced` recurs indefinitely by itself. Pair it with a stop condition
when the loop is meant to finish, or make the owning process lifetime explicit
when the loop is meant to run continuously.

`Schedule.jittered` changes delay timing only. It does not change the work
effect, the success value, or the error channel. Keep randomness in the schedule
so readers can understand the demand-shaping contract from one value.
