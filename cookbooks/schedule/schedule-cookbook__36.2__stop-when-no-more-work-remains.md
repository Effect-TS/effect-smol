---
book: Effect `Schedule` Cookbook
section_number: "36.2"
section_title: "Stop when no more work remains"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "36. Stop on Output Conditions"
status: "draft"
code_included: true
---

# 36.2 Stop when no more work remains

Use this pattern when each successful run reports whether more work is waiting.
The schedule should repeat while that report says work remains, then return the
last successful observation when the queue is empty.

This is a common shape for queue drains, batch processors, catch-up workers, and
maintenance jobs that should keep going while they are making progress, but
should stop cleanly when there is nothing left to do.

## Problem

A queue-drain effect processes one bounded batch and returns a result such as
`{ processed, remaining }`. One run is always useful because it discovers the
current backlog; after that, the schedule should continue only while `remaining`
says work is left.

Keep that decision in the schedule so reviewers can see both the cadence and the
termination rule, instead of finding a mutable loop counter or sleep hidden
inside the worker.

## When to use it

Use this recipe when the successful value contains a clear "remaining work"
signal, such as a queue depth, a continuation cursor, or a `hasMore` flag.

It is a good fit when each recurrence should wait before taking another batch.
That prevents a catch-up worker from turning a large backlog into a tight loop
that competes with foreground traffic.

## When not to use it

Do not use this as a replacement for queue acknowledgement, leasing, or
visibility timeout rules. The effect that drains the queue still owns those
delivery semantics.

Do not use this schedule to classify worker failures. `Effect.repeat` feeds
successful values into the schedule. Failures from the drain effect fail the
whole repeat unless you handle or retry them separately.

Avoid this shape when the queue can notify workers directly. A push signal,
stream, or consumer loop may be a better model than scheduled draining.

## Schedule shape

Use `Schedule.identity<DrainResult>()` to keep the latest successful drain
result as the schedule output, combine it with a spacing policy, and continue
only while `remaining` is greater than zero.

`Schedule.while` receives metadata for each successful step. Returning `true`
continues the schedule; returning `false` stops it and yields the latest output.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type DrainResult = {
  readonly processed: number
  readonly remaining: number
}

type QueueDrainError = {
  readonly _tag: "QueueDrainError"
  readonly message: string
}

const batches: ReadonlyArray<DrainResult> = [
  { processed: 25, remaining: 40 },
  { processed: 25, remaining: 15 },
  { processed: 15, remaining: 0 }
]

let drains = 0

const drainWorkQueue: Effect.Effect<DrainResult, QueueDrainError> = Effect.gen(function*() {
  const index = yield* Effect.sync(() => {
    const current = drains
    drains += 1
    return current
  })
  const result = batches[index] ?? batches[batches.length - 1]!

  yield* Console.log(
    `drain ${index + 1}: processed=${result.processed}, remaining=${result.remaining}`
  )
  return result
})

const drainUntilEmpty = Schedule.identity<DrainResult>().pipe(
  Schedule.bothLeft(Schedule.spaced("100 millis")),
  Schedule.while(({ output }) => output.remaining > 0)
)

const program = drainWorkQueue.pipe(
  Effect.repeat(drainUntilEmpty),
  Effect.flatMap((result) =>
    Console.log(`stopped with ${result.remaining} items remaining`)
  )
)

Effect.runPromise(program)
```

`drainWorkQueue` runs once immediately. If that first drain returns
`remaining: 0`, the schedule stops without waiting and `runDrain` succeeds with
that result.

If the first drain returns `remaining: 120`, the schedule waits before running
another drain. The example uses a short delay so it finishes quickly; production
drainers often use a longer cadence. The final result is the first observation
whose `remaining` value is `0`.

## Variants

Use `remaining > 0 && processed > 0` when the worker should stop if a run made
no progress, even if the queue still reports backlog. That avoids repeating
forever when work is stuck behind a poison item or unavailable partition.

Use a longer interval for background maintenance queues, or a shorter interval
for interactive catch-up work. The spacing is paid after each successful drain,
so long-running batches naturally push the next recurrence later.

Add a separate limit when an empty queue is not guaranteed. For example, combine
the drain condition with `Schedule.recurs` or `Schedule.during` when the worker
has a fixed maintenance window.

## Notes and caveats

`Effect.repeat` always performs the original effect before the schedule controls
any recurrence. The schedule decides whether to run again after observing the
successful `DrainResult`.

`Schedule.while` inspects successful values only. If `drainWorkQueue` fails, the
repeat fails unless the effect handles the error or the whole drain is wrapped
in a retry policy.

`Schedule.identity<DrainResult>()` is what makes `runDrain` return the latest
`DrainResult`. Without preserving the domain value, the result would come from a
timing schedule, such as the numeric output of `Schedule.spaced`.

Keep the reported `remaining` value meaningful. If it is approximate, stale, or
eventually consistent, add an operational guard such as an elapsed budget or a
recurrence cap so the worker cannot repeat forever on bad telemetry.
