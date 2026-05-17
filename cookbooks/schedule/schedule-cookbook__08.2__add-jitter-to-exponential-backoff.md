---
book: Effect `Schedule` Cookbook
section_number: "8.2"
section_title: "Add jitter to exponential backoff"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: true
---

# 8.2 Add jitter to exponential backoff

Add jitter to exponential backoff when multiple callers can fail together and
retry the same dependency.

## Problem

Exponential backoff reduces retry pressure over time, but callers that start
together can still retry together: 100 milliseconds later, 200 milliseconds
later, 400 milliseconds later, and so on.

Place `Schedule.jittered` after the exponential schedule. It keeps the
exponential shape and randomizes each delay between 80% and 120% of the delay
chosen by `Schedule.exponential`.

## When to use it

Use jittered exponential backoff for idempotent HTTP requests, queue operations,
cache lookups, database calls, and service-to-service requests where many
fibers, workers, or service instances may retry together.

The larger the caller population, the more important it is to avoid identical
retry times.

## When not to use it

Do not use jitter as a stopping condition. Add `Schedule.recurs`, `times`, an
elapsed-time limit, or another bound when the retry policy must be finite.

Do not use jitter when exact timing is required. For deterministic tests, either
avoid jitter or assert bounds instead of exact delays.

## Schedule shape

With a 10 millisecond base, exponential backoff produces 10 milliseconds, 20
milliseconds, 40 milliseconds, and 80 milliseconds. After `Schedule.jittered`,
those delays become ranges: 8-12 milliseconds, 16-24 milliseconds, 32-48
milliseconds, and 64-96 milliseconds.

`Schedule.both(Schedule.recurs(4))` adds a finite retry count without changing
the jittered delay.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class GatewayUnavailable extends Data.TaggedError("GatewayUnavailable")<{
  readonly status: number
}> {}

let attempts = 0

const callGateway: Effect.Effect<string, GatewayUnavailable> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`gateway attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new GatewayUnavailable({ status: 503 }))
  }

  return "gateway response"
})

const jitteredBackoff = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const program = callGateway.pipe(
  Effect.retry(jitteredBackoff),
  Effect.tap((value) => Console.log(`success: ${value}`))
)

Effect.runPromise(program).then(() => undefined, console.error)
```

The original call runs immediately. Each retry uses the exponential delay as a
base and then jitters that delay. If all four retries fail, the last typed
`GatewayUnavailable` is propagated.

## Variants

Use a smaller base delay for latency-sensitive work. Use a gentler exponential
factor, such as `1.5`, when doubling grows too quickly.

When only some typed failures should be retried, pass `Effect.retry({ schedule,
while })`. The predicate controls retry eligibility; the schedule controls
timing and count.

## Notes and caveats

`Schedule.jittered` does not take a percentage argument. Effect uses the fixed
80% to 120% range.

Place jitter after the delay shape you want to randomize. Additional composition
can then add limits, caps, predicates, or observability around the jittered
backoff.

Jitter spreads retry attempts, but it does not cap exponential growth. Long
retry policies still need a cap and a retry limit that match the caller's
budget.
