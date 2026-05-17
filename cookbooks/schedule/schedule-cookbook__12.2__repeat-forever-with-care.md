---
book: Effect `Schedule` Cookbook
section_number: "12.2"
section_title: "Repeat forever with care"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "12. Repeat a Successful Effect"
status: "draft"
code_included: true
---

# 12.2 Repeat forever with care

`Effect.repeat` can run successful work for the lifetime of a process, fiber, or scope.
This recipe focuses on doing that with an explicit owner and spacing policy.

## Problem

An unbounded repeat is easy to express, but it is also easy to make too
aggressive. `Schedule.forever` repeats with no delay. For most operational
loops, use an explicit spacing schedule so each successful run leaves room for
the rest of the system.

## When to use it

Use this for long-lived background work where success means "do it again": heartbeats, cache refreshes, lightweight health checks, and maintenance loops owned by a supervised fiber or application scope.

Use a forever repeat only when the surrounding program has a clear lifetime. The normal way to stop an unbounded repeat is interruption, cancellation of the owning fiber, or shutdown of the scope that owns it.

## When not to use it

Do not use a forever repeat for a request-response path that must return a value to its caller. If the effect keeps succeeding and the schedule is unbounded, the repeated program does not complete normally.

Do not use `Schedule.forever` for ordinary background polling unless a tight loop is intentional. It has zero delay between successful executions and can consume resources quickly.

Do not use `Effect.repeat` to recover from failures. A failure stops repetition. Use `Effect.retry` when failures should trigger another attempt.

## Schedule shape

The smallest forever schedule is `Schedule.forever`. It recurs forever and outputs the current repetition count: `0`, `1`, `2`, and so on.

For operational code, prefer a spaced forever schedule:

```ts
import { Schedule } from "effect"

const repeatEveryThirtySeconds = Schedule.spaced("30 seconds")
```

`Schedule.spaced(duration)` is also unbounded, but it waits for the duration after each successful run before starting the next recurrence. The first run still happens immediately; the schedule controls only what happens after a success.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

declare const refreshCache: Effect.Effect<void, "refresh-failed">

const refreshPolicy = Schedule.spaced("30 seconds").pipe(
  Schedule.tapOutput((repetition) => Console.log(`cache refresh repetition ${repetition}`))
)

const program = refreshCache.pipe(
  Effect.repeat(refreshPolicy)
)
```

This runs `refreshCache` once immediately. After each success, the schedule records the repetition count, waits thirty seconds, and allows the next run.

Because the schedule is unbounded, `program` is intended to be run as long-lived work. It completes only if `refreshCache` fails, the schedule fails, or the fiber is interrupted.

## Variants

Use `Schedule.forever` only when immediate repetition is deliberate:

```ts
import { Console, Effect, Schedule } from "effect"

const drainLocalQueue = Console.log("draining local queue")

const program = drainLocalQueue.pipe(
  Effect.repeat(Schedule.forever)
)
```

This shape has no built-in spacing. It is appropriate only when the effect itself blocks, waits, or consumes bounded local work. If the effect returns quickly, prefer `Schedule.spaced`.

Add schedule-level observability with `Schedule.tapOutput` when the repeat policy owns the operational signal. Add effect-level logging when the work itself owns the signal. Keeping the count in the schedule makes it clear that the value is about recurrence, not about the business result.

## Notes and caveats

`Effect.repeat` runs the effect once before consulting the schedule. A forever schedule therefore does not delay startup.

With a raw schedule, `Effect.repeat(schedule)` returns the schedule output if the schedule completes. A forever schedule does not complete by exhaustion, so this form is normally used for a long-lived effect rather than for its final value.

A forever repeat should have an owner. In application code, run it in a supervised fiber, scoped resource, or runtime structure that will interrupt it during shutdown.

Failures are not swallowed. If the repeated effect fails, repetition stops and the failure is returned. If failure should be logged and then retried, model that as retry behavior inside the repeated unit or use a retry policy at the appropriate boundary.
