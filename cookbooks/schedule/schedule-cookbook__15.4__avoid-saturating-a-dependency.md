---
book: Effect `Schedule` Cookbook
section_number: "15.4"
section_title: "Avoid saturating a dependency"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "15. Repeat with Controlled Spacing"
status: "draft"
code_included: true
---

# 15.4 Avoid saturating a dependency

Use `Schedule.spaced` when a successful repeat loop calls a shared dependency
and should leave that dependency breathing room between calls.

## Problem

A loop that calls a database, cache, queue, or internal service can keep that dependency
busy even when every individual call succeeds. Queues may grow, or other callers may
see worse latency, because the repeat loop never gives the system room to settle.

## When to use it

Use this when success should not mean "run again immediately."

This is common for maintenance loops, polling loops, batch-drain loops, and
periodic synchronization jobs where each iteration touches a shared dependency.
The goal is steady progress with a fixed pause between successful calls.

Use a bounded schedule when the repeat belongs to a command, migration, short worker pass, or test. The spacing limits pressure per unit of time; the bound limits the total amount of work performed by that loop.

## When not to use it

Do not use this to handle failed calls. `Effect.repeat` stops when the
dependency call fails. Use `Effect.retry` for failure-driven recovery.

Do not use this as a complete rate-limit implementation. This section is about spacing one successful repeat loop so it does not continuously press on a dependency.

Do not use this when work must run on wall-clock interval boundaries. `Schedule.spaced` waits after a successful run completes, so the start-to-start distance includes both the work duration and the configured spacing.

## Schedule shape

The basic shape is `Schedule.spaced("500 millis").pipe(Schedule.take(20))`.
`Schedule.spaced("500 millis")` waits 500 milliseconds after each successful
iteration before allowing the next recurrence.

`Schedule.take(20)` bounds the schedule to 20 scheduled recurrences after the first successful run. If all iterations succeed, the effect runs 21 times total.

Together, the schedule says: keep repeating after success, but leave a fixed gap between calls and stop after a known number of recurrences.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let batch = 0

const writeBatch = Effect.gen(function*() {
  batch += 1
  yield* Console.log(`wrote batch ${batch}`)
  return batch
})

const dependencyFriendlyRepeat = Schedule.spaced("10 millis").pipe(
  Schedule.take(2)
)

const program = Effect.gen(function*() {
  const finalRecurrence = yield* writeBatch.pipe(
    Effect.repeat(dependencyFriendlyRepeat)
  )
  yield* Console.log(`dependency loop stopped after recurrence ${finalRecurrence}`)
})

Effect.runPromise(program)
```

The first batch runs immediately. The next two batches are separated by the
configured pause. In production, choose a delay that reflects the dependency's
latency, quota, and impact on other callers.

## Variants

Use a longer fixed spacing when the dependency is sensitive to sustained
pressure. Use a bounded increasing schedule, such as
`Schedule.exponential("200 millis").pipe(Schedule.take(8))`, when later passes
should become less aggressive.

Both variants are still success-driven when used with `Effect.repeat`. They control when the next successful recurrence may happen; they do not convert failures into retries.

## Notes and caveats

The schedule does not delay the first run. `Effect.repeat` evaluates the effect once, then uses the schedule to control later recurrences.

Spacing protects only this loop. Other fibers, processes, or services may still call the same dependency at the same time.

The pause happens after successful completion. If one iteration takes a long time, `Schedule.spaced` still waits the configured duration after that iteration finishes.

Keep the loop bounded when the unit of work is finite or when the repeat is part of a larger operation. An unbounded spaced loop can be appropriate for a long-lived service, but it should be tied to that service's lifetime.
