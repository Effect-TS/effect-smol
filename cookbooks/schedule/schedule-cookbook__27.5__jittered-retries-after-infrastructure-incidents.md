---
book: Effect `Schedule` Cookbook
section_number: "27.5"
section_title: "Jittered retries after infrastructure incidents"
part_title: "Part VI — Jitter Recipes"
chapter_title: "27. Jitter for Retry"
status: "draft"
code_included: true
---

# 27.5 Jittered retries after infrastructure incidents

Infrastructure recovery is a high-risk moment because many callers may retry as
the same dependency comes back. Use jitter to keep the retry policy recognizable
while spreading fleet recovery.

## Problem

A safe recovery operation should retry after transient failures, back off under
pressure, and stop at a clear boundary. Without jitter, identical callers can
still align on the same 200 ms, 400 ms, 800 ms, and 1.6 s retry steps.

## When to use it

Use this recipe for post-incident recovery paths that may run across a fleet:
reconnecting to a database, re-establishing cache clients, retrying service
discovery calls, refreshing credentials after an identity provider outage, or
resuming workers after a broker restart.

It fits transient failures where retrying is expected to succeed once the
dependency stabilizes. The operation should be safe to retry, and the retry
policy should still have a clear limit so the incident does not create
unbounded background pressure.

Use jitter as a refinement to a deliberate retry shape. Choose the base delay,
growth rate, and retry count first; then apply `Schedule.jittered` so callers
keep the same operational shape while avoiding identical retry timestamps.

## When not to use it

Do not use jitter to make permanent failures look transient. Bad credentials,
invalid configuration, malformed requests, incompatible schema versions, and
other deterministic failures should stop before they reach the retry policy.

Do not rely on jitter alone when the recovering dependency needs hard
protection. If the fleet can produce more retry traffic than the dependency can
handle, combine jitter with concurrency limits, rate limits, circuit breakers,
queueing, or admission control.

Do not use this policy for unsafe non-idempotent operations unless the operation
has an idempotency key, de-duplication, transactional boundary, or another
guarantee that repeated execution is acceptable.

## Schedule shape

`Schedule.exponential("200 millis")` starts with a 200 millisecond delay and,
with the default factor of `2`, grows after each failure: 200 milliseconds, 400
milliseconds, 800 milliseconds, 1.6 seconds, and so on.

`Schedule.jittered` wraps that schedule and adjusts each selected delay between
80% and 120% of the original delay. The policy is still exponential, but callers
no longer share the exact same retry boundary.

`Schedule.both(Schedule.recurs(8))` adds the retry limit. Both schedules must
continue, so the policy allows at most eight retries after the original attempt.
The exponential schedule contributes the delay, `Schedule.jittered` spreads
that delay, and `Schedule.recurs(8)` contributes the stopping condition.

With `Effect.retry`, the original effect runs immediately. After a typed
failure, the failure is fed to the schedule. If the schedule continues, the next
attempt waits for the jittered delay. If the schedule stops,
`Effect.retry` propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class InfrastructureError extends Data.TaggedError("InfrastructureError")<{
  readonly dependency: "Database" | "Cache" | "IdentityProvider"
  readonly reason: "Unavailable" | "Overloaded" | "Restarting" | "Misconfigured"
}> {}

const isRecoverableInfrastructureError = (error: InfrastructureError) =>
  error.reason === "Unavailable" ||
  error.reason === "Overloaded" ||
  error.reason === "Restarting"

let attempt = 0

const reconnectInfrastructure = Effect.gen(function*() {
  attempt += 1
  yield* Effect.sync(() =>
    console.log(`database recovery attempt ${attempt}`)
  )

  if (attempt < 4) {
    return yield* Effect.fail(
      new InfrastructureError({
        dependency: "Database",
        reason: "Restarting"
      })
    )
  }

  yield* Effect.sync(() => console.log("database connection restored"))
})

const recoveryRetryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)

const program = reconnectInfrastructure.pipe(
  Effect.retry({
    schedule: recoveryRetryPolicy,
    while: isRecoverableInfrastructureError
  })
)

Effect.runPromise(program)
```

The sample uses short delays so it is easy to run locally. In production, keep
the same composition and choose a base delay that matches the dependency's
recovery profile.

## Variants

For a slower recovery path, start with a larger base delay and a higher retry
limit. For a steady maintenance-window retry cadence, jitter a
`Schedule.spaced` policy instead of an exponential one.

For a recovery path that must stop within a wall-clock budget, combine the
jittered cadence with `Schedule.during`. Use this when operators need a bounded
recovery attempt before surfacing the failure to a supervisor, health check, or
alerting path.

## Notes and caveats

`Schedule.jittered` changes timing, not retry eligibility. Keep failure
classification close to the effect with `while`, `until`, or a narrower typed
error model.

`Schedule.jittered` has fixed bounds in Effect: each selected delay is adjusted
between 80% and 120% of the original delay.

The first execution is not delayed. Jitter applies to recurrence delays after
the effect has failed and the retry schedule has decided to continue.

Jitter reduces alignment, but it does not reduce the number of callers
retrying. For large fleets, pair it with load-shedding mechanisms that cap total
pressure on the recovering dependency.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total executions.

The composed schedule output is nested schedule output. Plain `Effect.retry`
uses the schedule for timing and stopping, but the successful value is still the
value produced by the retried effect.
