---
book: Effect `Schedule` Cookbook
section_number: "35.1"
section_title: "Stop after 5 seconds"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "35. Stop After a Time Budget"
status: "draft"
code_included: true
---

# 35.1 Stop after 5 seconds

Use `Schedule.during("5 seconds")` when a retry or polling policy should keep
recurring only for a short elapsed-time window. Pair it with an explicit cadence
so the policy says both how often to try and when to stop scheduling more work.

This is a schedule budget, not a hard process timeout. It is evaluated at
schedule decision points after an attempt finishes. If one attempt hangs for
longer than five seconds, `Schedule.during("5 seconds")` will not interrupt it.

## Problem

A startup probe should retry briefly before reporting that readiness was not
reached. The five-second retry window should be visible in the schedule rather
than hidden in a loop with manual sleeps.

## When to use it

Use it for startup probes, short cache warmups, readiness checks, and
user-facing operations where a few retries are useful but the caller still needs
a prompt answer. The bound is elapsed recurrence time, not a fixed attempt
count.

## When not to use it

Do not use it as the only protection against slow in-flight work. A schedule
decides whether to run again; `Effect.timeout` is the tool that interrupts an
operation that is already running.

Do not use it to hide permanent failures. Validate inputs, classify errors, and
avoid retrying unsafe side effects before applying the schedule.

## Schedule shape

Pair a cadence such as `Schedule.spaced("1 second")` with
`Schedule.during("5 seconds")` using `Schedule.both`. The spaced schedule
provides the delay. The `during` schedule provides the elapsed-time stop
condition. The combined schedule stops as soon as either side stops.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type DependencyError = {
  readonly _tag: "DependencyError"
  readonly message: string
}

let attempts = 0

const checkDependency: Effect.Effect<void, DependencyError> = Effect.gen(function*() {
  const attempt = yield* Effect.sync(() => {
    attempts += 1
    return attempts
  })

  yield* Console.log(`readiness probe ${attempt}`)
  return yield* Effect.fail({
    _tag: "DependencyError",
    message: "database is still starting"
  })
})

const retryForUpToFiveSeconds = Schedule.spaced("10 millis").pipe(
  Schedule.both(Schedule.during("50 millis"))
)

const program = checkDependency.pipe(
  Effect.retry(retryForUpToFiveSeconds),
  Effect.catch((error) =>
    Console.log(`stopped after ${attempts} probes: ${error.message}`)
  )
)

Effect.runPromise(program)
```

`checkDependency` runs once before the schedule is consulted. If it fails, the
demo schedule waits 10 milliseconds before the next attempt while the short
budget is still open. When the schedule stops recurring, `Effect.retry` returns
the latest failure; the example handles it and logs the final attempt count.

The snippet uses millisecond values so it finishes quickly when pasted into a
file. The production shape is the same with `Schedule.spaced("1 second")` and
`Schedule.during("5 seconds")`.

## Variants

Use a shorter cadence for very cheap local checks, and a longer cadence for
remote calls that could add load during an outage. For many clients running the
same policy, add `Schedule.jittered` after the cadence is correct so they do not
all retry at the same moments.

If the caller needs the whole operation to be interrupted at five seconds,
combine this schedule-side budget with `Effect.timeout` at the operation
boundary. Keep the two responsibilities separate: the schedule describes retry
recurrence, while the timeout describes interruption.

## Notes and caveats

`Schedule.during` returns elapsed duration as its output. In this recipe the
output is not used; the schedule exists for its recurrence decision.

The five-second budget is approximate in the practical sense that recurrence
decisions happen between attempts. Long attempts and their own timeouts should
be handled in the effect being retried.
