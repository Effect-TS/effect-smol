---
book: Effect `Schedule` Cookbook
section_number: "9.5"
section_title: "Prefer time-budget limits over attempt counts"
part_title: "Part II — Core Retry Recipes"
chapter_title: "9. Retry with Deadlines and Budgets"
status: "draft"
code_included: true
---

# 9.5 Prefer time-budget limits over attempt counts

Use a time budget when the requirement is about latency, not about the number
of times an operation may run.

## What this section is about

An attempt count answers "how many retries may be scheduled after the original
attempt?" A time budget answers "how long may this retry window stay open?"
Those are related, but not interchangeable.

In Effect, the usual shape is a delay schedule combined with
`Schedule.during`. The delay schedule controls cadence. `Schedule.during`
controls the elapsed retry window.

## Why it matters

Fixed retry counts are easy to read but weak as latency limits. Three retries
can finish almost immediately when failures are fast, or take much longer when
each failed attempt waits on a network boundary before returning a typed
failure.

Time budgets express the boundary most callers care about: how long they are
willing to keep retrying. A startup check may get two minutes. A background job
may get 30 seconds. A user-facing request may get only a brief recovery window.

## Core idea

Start with the delay shape, then add the budget with `Schedule.both`. Because
`both` requires both schedules to continue, the policy stops when the elapsed
window closes. Because `both` uses the maximum delay, the retry cadence still
comes from `Schedule.spaced`, `Schedule.fixed`, or `Schedule.exponential`.

Use `Schedule.recurs` as a secondary guard only when the count itself is a real
requirement.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class RemoteBusy extends Data.TaggedError("RemoteBusy")<{
  readonly attempt: number
}> {}

let attempts = 0

const callRemote: Effect.Effect<string, RemoteBusy> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`remote attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new RemoteBusy({ attempt: attempts }))
  }

  return "remote value"
})

const retryWithinLatencyBudget = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.during("1 second"))
)

const program = Effect.gen(function*() {
  const value = yield* callRemote.pipe(
    Effect.retry(retryWithinLatencyBudget)
  )

  yield* Console.log(`completed with: ${value}`)
})

Effect.runPromise(program)
```

This policy does not promise exactly three retries. It retries according to the
backoff schedule while the one-second retry window is open.

## Common mistakes

Do not treat `Schedule.recurs(3)` as a latency budget. It limits retry count,
not elapsed time.

Do not use `Schedule.during` by itself for production retry policies. It has no
useful spacing on its own, so a fast-failing effect can retry aggressively
until the window closes.

Do not choose a time budget to hide the wrong retry predicate. Permanent
failures such as bad input, invalid credentials, forbidden access, and
misconfiguration should usually stop immediately.

## Practical guidance

Use `Schedule.exponential` when repeated failures should slow down over time.
Use `Schedule.spaced` when the cadence should be steady. Use `Schedule.fixed`
when retries should align to a fixed-rate interval instead of waiting a fixed
duration after each failed attempt completes.

Add `Schedule.recurs` only as a secondary cap when the number of retries is
operationally meaningful. For most service-boundary code, the time budget is
the clearer primary limit because it matches the caller's waiting tolerance.
