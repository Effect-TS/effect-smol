---
book: "Effect `Schedule` Cookbook"
section_number: "10.5"
section_title: "Use spacing to smooth resource usage"
part_title: "Part III — Repeat Recipes"
chapter_title: "10. Periodic and Spaced Repeat"
status: "draft"
code_included: true
---

# 10.5 Use spacing to smooth resource usage

Use `Schedule.spaced` when a successful repeat loop should spread resource use
over time instead of producing bursts.

## Problem

Each run may consume CPU, database connections, queue visibility checks, cache
bandwidth, file handles, or external API quota. If the next iteration starts
immediately after each success, the loop can create bursts of usage even when every
individual run is correct.

## When to use it

Use this when the loop should keep making progress, but each successful
iteration should leave a predictable gap before the next one starts.

This is useful for polling, periodic cleanup, small batch processing, and maintenance work where the exact wall-clock boundary is less important than avoiding back-to-back successful runs.

Use `Schedule.spaced(duration)` when the policy is "after a successful run completes, wait this long before the next recurrence."

## When not to use it

Do not use this to retry failures. `Effect.repeat` stops when the effect fails.
Use `Effect.retry` for failure-driven recovery.

Do not use this as a full rate limiter. Spacing one repeat loop smooths that loop's own resource usage, but it does not coordinate with other fibers, processes, users, or services.

Do not use this when work must run on fixed interval boundaries. `Schedule.spaced` waits after completion, so the time between starts includes both the work duration and the configured spacing. Use `Schedule.fixed(duration)` for fixed-rate cadence.

## Schedule shape

The central shape is `Schedule.spaced("1 second").pipe(Schedule.take(30))`.
`Schedule.spaced("1 second")` waits one second after each successful iteration
before allowing the next recurrence.

`Schedule.take(30)` bounds the repeat to 30 scheduled recurrences after the initial successful run. If every run succeeds, the effect runs 31 times total.

Together, the schedule says: run now, then keep repeating after success with a fixed gap between completed work items, and stop after a known recurrence limit.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

let batch = 0

const processOneBatch = Effect.gen(function*() {
  batch += 1
  yield* Console.log(`processed batch ${batch}`)
  return batch
})

const smoothBatchSchedule = Schedule.spaced("10 millis").pipe(
  Schedule.take(3)
)

const program = Effect.gen(function*() {
  const finalRecurrence = yield* processOneBatch.pipe(
    Effect.repeat(smoothBatchSchedule)
  )
  yield* Console.log(`smoothing run stopped after recurrence ${finalRecurrence}`)
})

Effect.runPromise(program)
```

The example prints four batch runs with a short pause between successful
recurrences. Use a larger duration when smoothing real CPU, connection, cache,
or API pressure.

## Variants

Use shorter spacing when responsiveness matters and each iteration is cheap.
Use longer spacing when repeated work competes with interactive traffic, keeps
connections open, or causes visible load on a dependency.

For finite jobs, keep the recurrence limit explicit with `Schedule.take` or
another stopping rule.

For long-lived services, the schedule can be unbounded, but the fiber running the repeat should still be tied to the service lifetime.

## Notes and caveats

The spacing is applied after successful completion, not before the first run.

The duration of the work is not hidden by the schedule. If one iteration takes three seconds and the spacing is one second, the next start is roughly four seconds after the previous start.

Spacing smooths only this repeat loop. It does not provide a global request budget, distributed coordination, or fairness across callers.

Choose a spacing that matches the resource being protected. A database maintenance loop, a local cache refresh, and an external API poll usually need different gaps.

`Schedule.spaced` is unbounded by itself. Add `Schedule.take` or another stopping rule when the repeat belongs to a finite operation, test, or command-line program.
