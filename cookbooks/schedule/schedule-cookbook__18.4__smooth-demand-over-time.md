---
book: "Effect `Schedule` Cookbook"
section_number: "18.4"
section_title: "Smooth demand over time"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "18. Spacing and Throttling"
status: "draft"
code_included: true
---

# 18.4 Smooth demand over time

Use `Schedule.spaced` and, when needed, `Schedule.jittered` to turn repeated
work into a paced stream with visible timing rules.

## Problem

Queue draining, cache warming, search indexing, and remote API calls can create
uneven pressure when they run as quickly as possible: idle time, a burst of
requests, then more idle time.

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

## Example

```ts
import { Console, Effect, Random, Ref, Schedule } from "effect"

type WorkItem = {
  readonly id: string
}

type WorkerError = {
  readonly _tag: "WorkerError"
}

const initialItems: ReadonlyArray<WorkItem> = [
  { id: "job-1" },
  { id: "job-2" },
  { id: "job-3" },
  { id: "job-4" }
]

const smoothedDemand = Schedule.spaced("40 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<number>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input > 0)
)

const program = Effect.gen(function*() {
  const queue = yield* Ref.make(initialItems)

  const processNextItem: Effect.Effect<number, WorkerError> = Effect.gen(
    function*() {
      const item = yield* Ref.modify(queue, (items) => [
        items[0],
        items.slice(1)
      ] as const)

      if (item === undefined) {
        return 0
      }

      yield* Console.log(`processed ${item.id}`)

      const remaining = yield* Ref.get(queue)
      return remaining.length
    }
  )

  const remaining = yield* processNextItem.pipe(
    Effect.repeat(smoothedDemand),
    Random.withSeed("smoothed-demand-demo")
  )

  yield* Console.log(`queue drained; remaining=${remaining}`)
})

Effect.runPromise(program)
```

The first `processNextItem` run happens immediately. The schedule controls only
the follow-up repetitions. Each successful run is followed by a jittered delay
around the base spacing, and `Schedule.while` stops the loop when the worker
reports that no items remain. The snippet uses millisecond-scale spacing so it
finishes quickly in a scratchpad.

## Variants

For a single worker where only local pacing matters, remove `Schedule.jittered`
and keep the spacing deterministic.

For a larger fleet, keep the jitter even when the base interval is short. The
spacing controls average demand; the jitter reduces alignment between instances.

For long-running workers, make the lifecycle boundary explicit in the fiber,
queue, or service that owns the loop. Keep the spacing policy named so operators
can still see the intended load profile.

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
