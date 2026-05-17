---
book: "Effect `Schedule` Cookbook"
section_number: "20.3"
section_title: "Recovery spikes"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "20. Jitter Concepts and Tradeoffs"
status: "draft"
code_included: true
---

# 20.3 Recovery spikes

Use jittered backoff after an outage so recovery traffic spreads out instead of
forming synchronized retry waves.

## Problem

Recovery can become its own incident. If every process uses the same
deterministic retry sequence, retry waves can line up across the fleet just as a
dependency is trying to recover.

The first attempt still happens normally. The schedule only decides what to do
after a typed failure is fed to `Effect.retry`.

## When to use it

Use it when many clients, workers, pods, or service instances retry the same
dependency after broker restarts, database failovers, network partitions,
rollbacks, or regional control-plane incidents.

This is a good default when the operation is safe to retry and the downstream
system benefits from recovery traffic being spread out.

## When not to use it

Do not use jitter to make unsafe writes retryable. Classify validation errors,
authorization errors, malformed requests, and non-idempotent operations before
applying the schedule.

Avoid jitter when timing itself is the contract, such as a fixed-rate heartbeat
that another system interprets precisely.

## Schedule shape

Build the operational shape first, then jitter it:

- `Schedule.exponential("200 millis")` creates the increasing recovery delay
- `Schedule.jittered` spreads each computed delay by 80% to 120%
- `Schedule.both(Schedule.recurs(6))` stops after a bounded number of retries

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class DependencyUnavailable extends Data.TaggedError("DependencyUnavailable")<{
  readonly service: string
  readonly instance: string
  readonly attempt: number
}> {}

const recoveryRetryPolicy = Schedule.exponential("30 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6))
)

const recoverInstance = (instance: string) => {
  let attempts = 0

  const refreshFromDependency = Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`${instance} refresh attempt ${attempts}`)

    if (attempts < 3) {
      return yield* Effect.fail(
        new DependencyUnavailable({
          service: "orders-db",
          instance,
          attempt: attempts
        })
      )
    }

    return `${instance} recovered`
  })

  return refreshFromDependency.pipe(
    Effect.retry(recoveryRetryPolicy),
    Effect.flatMap(Console.log)
  )
}

const program = Effect.forEach(
  ["instance-a", "instance-b", "instance-c"],
  recoverInstance,
  { concurrency: 3, discard: true }
)

Effect.runPromise(program)
```

Each instance keeps the same general backoff shape, but its individual delays
are randomly adjusted. The fleet no longer has to retry on identical boundaries
during recovery.

## Variants

Use a smaller base delay when the dependency is local and cheap to probe. Use a
larger base delay when the dependency is expensive to warm up or has strict rate
limits. Add `Schedule.during` when the retry policy needs an elapsed recovery
budget.

## Notes and caveats

Jitter is not a rate limiter. It spreads retry timing, but it does not enforce a
global concurrency limit or coordinate work across processes. Combine it with
downstream limits when the system needs hard protection.
