---
book: Effect `Schedule` Cookbook
section_number: "40.4"
section_title: "Warm-up polling followed by regular monitoring"
part_title: "Part IX — Composition Recipes"
chapter_title: "40. Warm-up and Steady-State Schedules"
status: "draft"
code_included: true
---

# 40.4 Warm-up polling followed by regular monitoring

Some services need two different polling behaviors in one loop. During warm-up,
you want short gaps so readiness is detected quickly. After that first responsive
window, you still want monitoring, but at a calmer cadence that is easier on the
dependency.

Model those phases as schedules and compose them. The initial effect still runs
immediately; the schedule controls only the recurrences that follow.

## Problem

You need to poll aggressively for a short warm-up window, then keep polling at a
regular monitoring interval. A single `Schedule.spaced("1 second")` is too noisy
for steady state, while a single `Schedule.spaced("30 seconds")` is too slow for
startup.

## When to use it

Use this for readiness checks, background job status pages, dependency warm-up,
and control-plane polling where early responsiveness matters more than long-term
freshness.

It is a good fit when both answers should be obvious from the code:

- how long the warm-up phase stays fast
- how often the steady monitoring phase runs afterward

## When not to use it

Do not use this shape when the loop should stop as soon as a terminal status is
observed. In that case, combine the cadence with an input-sensitive condition
such as `Schedule.passthrough` and `Schedule.while`.

Also avoid polling when the system can provide a push notification, queue signal,
or direct acknowledgement.

## Schedule shape

Use `Schedule.andThen` to run one schedule to completion and then continue with
the next one. Keep the phases named:

- `warmUpPolling` describes the short, responsive phase
- `regularMonitoring` describes the slower steady phase
- `pollingPolicy` documents that the two phases are sequential

`Schedule.take` is useful for making the warm-up phase finite. The second phase
can be unbounded for a daemon, or bounded with `Schedule.take`,
`Schedule.recurs`, or `Schedule.during` when the caller needs a final answer.

## Code

```ts
import { Effect, Schedule } from "effect"

type Health =
  | { readonly _tag: "Starting" }
  | { readonly _tag: "Ready" }
  | { readonly _tag: "Degraded" }

type HealthCheckError = { readonly _tag: "HealthCheckError" }

declare const readHealth: Effect.Effect<Health, HealthCheckError>

const warmUpPolling = Schedule.spaced("1 second").pipe(
  Schedule.take(10)
)

const regularMonitoring = Schedule.spaced("30 seconds")

const pollingPolicy = Schedule.andThen(warmUpPolling, regularMonitoring)

export const program = Effect.repeat(readHealth, pollingPolicy)
```

## Variants

For a bounded command-line check, make both phases finite:

```ts
const regularMonitoring = Schedule.spaced("30 seconds").pipe(
  Schedule.take(4)
)
```

For a fleet of instances, add jitter after the base timing is correct:

```ts
const regularMonitoring = Schedule.spaced("30 seconds").pipe(
  Schedule.jittered
)
```

For a strict wall-clock monitoring cadence, use `Schedule.fixed` for the steady
phase instead of `Schedule.spaced`. `spaced` waits after each check completes;
`fixed` tries to stay aligned to the interval boundary.

## Notes and caveats

`Schedule.andThen(left, right)` runs the left schedule until it completes, then
runs the right schedule. In this recipe, that means the warm-up recurrences are
used first and the monitoring recurrences are used afterward.

`Effect.repeat` repeats only after a successful run. If `readHealth` fails, the
repeat loop fails unless you handle or retry that error separately. Keep retrying
failed health checks as a separate policy from repeating successful health
observations.
