---
book: "Effect `Schedule` Cookbook"
section_number: "15.6"
section_title: "Jittered status checks in distributed systems"
part_title: "Part IV — Polling Recipes"
chapter_title: "15. Adaptive and Fleet-Safe Polling"
status: "draft"
code_included: true
---

# 15.6 Jittered status checks in distributed systems

Distributed workers often need regular status checks, but a whole fleet should
not call the same dependency at the same instant. Jitter keeps each worker near
the intended cadence while letting checks drift apart.

## Problem

Workers may check leases, shard assignments, replication tasks, queue drains, or
long-running operations owned by another service. A fixed interval is simple,
but workers that restart together or receive the same batch together can remain
synchronized.

Use jitter when the exact second is not important and the operational goal is a
steadier stream of status reads.

## When to use it

Use this when multiple replicas, workers, or service instances poll the same
kind of status endpoint.

It fits checks that should happen regularly, but where one worker checking a
little earlier or later has no semantic meaning.

## When not to use it

Do not use jitter as a completion rule. The status value still decides whether
the remote work is active or terminal.

Do not use it for exact boundary checks, coordinated leader actions, or jobs
where all instances intentionally sample at the same time.

Do not use it as a replacement for concurrency limits, quotas, or backpressure
when the dependency has hard capacity limits.

## Schedule shape

Combine a base polling interval with `Schedule.jittered`, preserve the latest
status using `Schedule.passthrough`, and continue only while the status is still
active.

Effect's `Schedule.jittered` changes each recurrence delay to 80% to 120% of
the original delay. A ten-second interval becomes a delay between eight and
twelve seconds.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type WorkerStatus =
  | { readonly state: "running"; readonly workerId: string; readonly taskId: string }
  | { readonly state: "complete"; readonly workerId: string; readonly taskId: string }

const scriptedStatuses: ReadonlyArray<WorkerStatus> = [
  { state: "running", workerId: "worker-a", taskId: "task-9" },
  { state: "running", workerId: "worker-a", taskId: "task-9" },
  { state: "complete", workerId: "worker-a", taskId: "task-9" }
]

let readIndex = 0

const checkWorkerStatus = (
  workerId: string,
  taskId: string
): Effect.Effect<WorkerStatus> =>
  Effect.sync(() => {
    const status = scriptedStatuses[
      Math.min(readIndex, scriptedStatuses.length - 1)
    ]!
    readIndex += 1
    return status
  }).pipe(
    Effect.tap((status) =>
      Console.log(`[${workerId}/${taskId}] ${status.state}`)
    )
  )

const distributedStatusChecks = Schedule.spaced("25 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<WorkerStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)

const program = checkWorkerStatus("worker-a", "task-9").pipe(
  Effect.repeat(distributedStatusChecks),
  Effect.tap((status) => Console.log(`final status: ${status.state}`))
)

Effect.runPromise(program).then((status) => {
  console.log("result:", status)
})
```

Each worker evaluates its own schedule. Even if several workers start together,
later checks choose independent jittered delays around the same base interval.

## Variants

Use a shorter base interval for cheap local checks. Use a longer interval for
shared databases, control services, or external APIs.

Add a recurrence cap when a worker should stop after a bounded number of active
observations. Treat the final active status as "not finished in time" rather
than as success.

Retry transient failures inside the status-check effect when appropriate.
`Effect.repeat` itself repeats successes; it does not turn failed reads into
status values.

## Notes and caveats

`Schedule.jittered` does not expose configurable bounds; the range is fixed at
80% to 120%.

The first status check runs immediately. The schedule controls only later
recurrences.

Use `Schedule.satisfiesInputType<T>()` before `Schedule.while` when the
predicate reads the latest successful status from `metadata.input`.
