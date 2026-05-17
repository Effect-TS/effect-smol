---
book: Effect `Schedule` Cookbook
section_number: "19.3"
section_title: "Jittered status checks in distributed systems"
part_title: "Part IV — Polling Recipes"
chapter_title: "19. Poll with Jitter"
status: "draft"
code_included: true
---

# 19.3 Jittered status checks in distributed systems

Distributed status checks often need regular observation without turning the
fleet into synchronized callers. Jitter keeps each instance near the intended
cadence while letting checks drift apart.

## Problem

Many workers or service instances need to check the status of remote work:
leases, shard assignments, replication tasks, queue drains, or long-running
operations owned by another service.

A fixed interval is easy to reason about, but it can accidentally synchronize
instances. If many workers start at the same time, restart after an incident, or
receive the same assignment batch, they may all check status on the same
boundaries.

Use a jittered polling schedule so each worker keeps the same approximate
cadence while its individual checks drift away from the rest of the fleet.

## When to use it

Use this when multiple distributed workers, replicas, or service instances poll
the same kind of status endpoint.

It fits status checks where the exact second is not important, but the system
still needs regular progress observation.

Use it when you want a steady operational cadence without turning every
instance into a synchronized caller of the same dependency.

## When not to use it

Do not use jitter as a completion rule. It changes recurrence delays; it does
not decide whether the remote work is done.

Do not use this for checks that must happen at exact wall-clock boundaries.
Jitter intentionally moves each recurrence around the original delay.

Do not use jitter as your only protection for a dependency that needs strict
capacity controls. Concurrency limits, quotas, and backpressure are separate
parts of the design.

## Schedule shape

Start with the normal status-check interval, add jitter, keep the latest status,
and continue while the status is still active:

```ts
Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<WorkerStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)
```

`Schedule.spaced("10 seconds")` supplies the base delay between successful
status checks. `Schedule.jittered` randomly adjusts each recurrence delay
between 80% and 120% of that delay, so a ten-second interval becomes a delay
between eight seconds and twelve seconds.

`Schedule.satisfiesInputType<WorkerStatus>()` makes the timing schedule accept
status values before `Schedule.while` reads `metadata.input`.
`Schedule.passthrough` keeps the latest successful status as the repeat result.

## Code

```ts
import { Effect, Schedule } from "effect"

type WorkerStatus =
  | { readonly state: "running"; readonly workerId: string; readonly taskId: string }
  | { readonly state: "complete"; readonly workerId: string; readonly taskId: string }
  | { readonly state: "failed"; readonly workerId: string; readonly taskId: string; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isRunning = (status: WorkerStatus): boolean => status.state === "running"

declare const checkWorkerStatus: (
  workerId: string,
  taskId: string
) => Effect.Effect<WorkerStatus, StatusCheckError>

const distributedStatusChecks = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<WorkerStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isRunning(input))
)

const pollWorkerTask = (workerId: string, taskId: string) =>
  checkWorkerStatus(workerId, taskId).pipe(
    Effect.repeat(distributedStatusChecks)
  )
```

`pollWorkerTask` performs the first status check immediately. If that status is
terminal, no further check is scheduled. If it is still `"running"`, the next
check waits for a jittered delay around ten seconds.

Each worker instance evaluates its own schedule. Across a fleet, the base
cadence remains about ten seconds, but individual checks are less likely to
land on the same instant.

## Variants

Add a recurrence cap when a worker should stop after a bounded number of
successful status observations:

```ts
const boundedDistributedStatusChecks = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<WorkerStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isRunning(input)),
  Schedule.bothLeft(
    Schedule.recurs(60).pipe(Schedule.satisfiesInputType<WorkerStatus>())
  )
)
```

This still returns the latest observed `WorkerStatus`. It may be terminal, or
it may be the last `"running"` status observed before the recurrence cap stops
the repeat.

Use a shorter base interval for cheap, local status checks. Use a longer base
interval for checks that call a shared database, control service, or external
API. The jitter range follows the chosen delay: a five-second interval becomes
four to six seconds, while a thirty-second interval becomes twenty-four to
thirty-six seconds.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It randomly adjusts each
recurrence delay between 80% and 120% of the original delay.

The first status check is not delayed. The schedule controls recurrences after
successful checks.

With `Effect.repeat`, a failure from `checkWorkerStatus` stops the repeat
unless the status-check effect has its own retry policy.

`Schedule.while` sees successful status values. It does not classify transport,
decoding, or service errors from the effect error channel.

When combining timing schedules with status predicates, use
`Schedule.satisfiesInputType<T>()` before reading `metadata.input`.
