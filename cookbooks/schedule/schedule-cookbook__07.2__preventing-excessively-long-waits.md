---
book: Effect `Schedule` Cookbook
section_number: "7.2"
section_title: "Preventing excessively long waits"
part_title: "Part II — Core Retry Recipes"
chapter_title: "7. Retry with Capped Backoff"
status: "draft"
code_included: true
---

# 7.2 Preventing excessively long waits

Use a capped schedule when exponential growth is useful, but very long waits are
not useful to the caller.

## Problem

After enough failures, exponential backoff can wait longer than the operation is
worth. The caller may need a failure result, the job may need to release its
lease, or an operator may expect the workflow to stop within a known window.

Use `Schedule.either` with a fixed `Schedule.spaced` schedule to cap each delay,
then add a separate retry limit. The cap and retry count solve different
problems and usually belong together.

## When to use it

Use this policy for idempotent calls to services that may be overloaded,
rate-limited, restarting, or briefly unavailable. Short early waits absorb
small interruptions. The cap prevents later waits from becoming operationally
surprising.

Choose the cap from the caller's budget, not from the downstream service alone.
A web request, queue job, and supervisor loop often need different caps for the
same dependency.

## When not to use it

Do not retry permanent failures such as invalid input, missing authorization, or
a request the downstream will never accept. Those should fail fast or be handled
by domain logic.

Do not treat the delay cap as an attempt timeout. A schedule controls the delay
between attempts; it does not stop an attempt that is currently running.

## Schedule shape

`Schedule.exponential("10 millis")` produces 10 milliseconds, 20 milliseconds,
40 milliseconds, 80 milliseconds, and so on. `Schedule.spaced("50 millis")`
always contributes 50 milliseconds. `Schedule.either` chooses the smaller delay,
so the effective sequence is 10 milliseconds, 20 milliseconds, 40 milliseconds,
50 milliseconds, 50 milliseconds, and so on.

`Schedule.both(Schedule.recurs(5))` makes the policy finite. `both` continues
only while both schedules continue, so the retry count stops the otherwise
unbounded capped backoff.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
  readonly status: number
}> {}

interface AccountSummary {
  readonly id: string
  readonly balance: number
}

let attempts = 0

const loadAccountSummary = (id: string): Effect.Effect<AccountSummary, ServiceUnavailable> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`load ${id}: attempt ${attempts}`)

    if (attempts < 4) {
      return yield* Effect.fail(new ServiceUnavailable({
        service: "accounts",
        status: 503
      }))
    }

    return { id, balance: 125 }
  })

const cappedBackoff = Schedule.exponential("10 millis").pipe(
  Schedule.either(Schedule.spaced("50 millis")),
  Schedule.both(Schedule.recurs(5))
)

const program = loadAccountSummary("account-123").pipe(
  Effect.retry(cappedBackoff),
  Effect.tap((account) => Console.log(`balance: ${account.balance}`))
)

Effect.runPromise(program).then(() => undefined, console.error)
```

The first attempt runs immediately. If it fails, retries use the capped delay
sequence and stop after at most five retries. If every permitted attempt fails,
`Effect.retry` returns the last `ServiceUnavailable`.

## Variants

For user-facing flows, use a low cap and a small retry count so the UI can move
to an error state quickly.

For background workflows, a higher cap can be acceptable, but keep the retry
budget explicit unless another layer owns the stopping condition.

When only some typed failures are retryable, use `Effect.retry({ schedule,
while })` and keep the predicate close to the boundary where the error is
known.

## Notes and caveats

`Schedule.either` gives union-style continuation semantics and uses the minimum
delay. The minimum-delay rule is what creates the cap.

`Schedule.both` applies the finite retry budget. Pairing the capped schedule
with `Schedule.recurs(n)` preserves the capped delay while adding the stopping
condition.

A cap prevents excessive individual waits. It does not add jitter, read
provider-specific retry headers, or make non-idempotent work safe to retry.
