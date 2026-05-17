---
book: "Effect `Schedule` Cookbook"
section_number: "24.4"
section_title: "Immediate retries first, backoff later"
part_title: "Part VI — Composition and Termination"
chapter_title: "24. Multi-Phase Policies"
status: "draft"
code_included: true
---

# 24.4 Immediate retries first, backoff later

Some transient failures clear before a meaningful delay would help: a stale
pooled connection, a dependency that just became reachable, or a short
optimistic-concurrency conflict. A small immediate retry burst is reasonable
there, but only while the failure still looks brief.

If the failure survives that burst, switch to backoff. `Schedule.andThen`
models that handoff directly: one schedule runs to completion, then the next
schedule starts.

## Problem

Build a retry policy with two visible phases: a bounded zero-delay burst, then
a bounded exponential backoff. If both phases are exhausted, `Effect.retry`
returns the last typed failure.

## When to use it

Use this when one or two instant retries are acceptable, but continued failure
means the dependency needs time. It fits idempotent reads, health checks, cache
refreshes, and small remote calls. Idempotent means repeating the operation has
the same externally visible result as running it once.

## When not to use it

Do not use this for permanent failures such as validation errors, authorization
failures, malformed requests, missing configuration, or non-idempotent writes.
Classify those before applying the schedule.

Do not make the immediate phase large. If you need many retries, start with
spacing or backoff instead.

## Schedule shape

`Schedule.recurs(2)` allows two retry decisions after the original attempt.
`Schedule.exponential(...).pipe(Schedule.take(4))` allows four delayed retries.
Sequencing them with `Schedule.andThen` keeps the phase boundary reviewable.

For `Effect.retry`, the original effect execution is not counted by the
schedule. The schedule starts only after a typed failure.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly status: number
  readonly message: string
}> {}

let attempts = 0

const callGateway = Effect.gen(function*() {
  attempts++
  yield* Console.log(`gateway attempt ${attempts}`)

  if (attempts <= 4) {
    return yield* Effect.fail(
      new GatewayError({
        status: 503,
        message: `temporary failure ${attempts}`
      })
    )
  }

  return `gateway succeeded on attempt ${attempts}`
})

const isRetryable = (error: GatewayError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const immediateRetries = Schedule.recurs(2)

const delayedBackoff = Schedule.exponential("20 millis").pipe(
  Schedule.take(4)
)

const immediateThenBackoff = immediateRetries.pipe(
  Schedule.andThen(delayedBackoff),
  Schedule.satisfiesInputType<GatewayError>(),
  Schedule.while(({ input }) => isRetryable(input))
)

const program = callGateway.pipe(
  Effect.retry(immediateThenBackoff),
  Effect.flatMap((result) => Console.log(result))
)

Effect.runPromise(program)
```

The retry sequence is:

- attempt 1: run `callGateway`
- retry 1: immediate, if the first attempt fails with a retryable `GatewayError`
- retry 2: immediate, if the second attempt fails with a retryable `GatewayError`
- retry 3: wait according to the first backoff delay
- retry 4 and later: continue the bounded backoff phase

If all retry decisions are exhausted, `Effect.retry` returns the last typed
failure. If `isRetryable` returns `false`, the schedule stops immediately and
that failure is returned without entering the remaining phase.

## Variants

For a user-facing request, reduce the backoff phase or add a short elapsed
budget with `Schedule.during`, so the caller gets a clear answer quickly.

For a fleet-wide remote dependency, consider adding `Schedule.jittered` to the
backoff phase after the base cadence is correct. Jitter means randomizing each
delay slightly to avoid synchronized retries across many instances. It belongs
in the delayed phase; adding randomness to the immediate burst weakens the
"immediate first" contract.

For startup checks, the immediate phase can be slightly larger when the
operation is local and cheap. Keep the backoff phase explicit so later startup
failure does not spin.

## Notes and caveats

`Schedule.recurs(2)` means two retry decisions after the original attempt, not
two total executions.

`Schedule.exponential(...)` recurs forever by itself, so the example uses
`Schedule.take(4)` to bound the delayed phase.

`Schedule.andThen` is sequential composition, not parallel composition. Use it
when phase order is part of the policy. Use combinators such as `Schedule.both`
when two constraints should apply at the same time.
