---
book: Effect `Schedule` Cookbook
section_number: "9.3"
section_title: "Retry until a startup deadline"
part_title: "Part II — Core Retry Recipes"
chapter_title: "9. Retry with Deadlines and Budgets"
status: "draft"
code_included: true
---

# 9.3 Retry until a startup deadline

Use this recipe for startup gates that should wait briefly for a required
dependency before serving traffic. The schedule expresses the readiness retry
window; surrounding code still decides which startup failures are retryable.

## Problem

Build a readiness-check policy that uses exponential backoff while a 30 second
startup retry window remains open:

```ts
const startupReadinessPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)
```

This means "retry with exponential backoff while the startup retry window is
still open." If the dependency becomes ready, startup continues. If the window
closes while the readiness check is still failing, `Effect.retry` propagates
the last typed failure.

## When to use it

Use this recipe when startup has a time budget rather than a fixed retry count.
It fits readiness checks for databases, caches, queues, service endpoints, or
local companion processes that often become reachable shortly after the
application process starts.

Use it when the readiness check is safe to repeat. A ping, connection probe, or
idempotent "is the dependency accepting requests?" call is a good fit.

This is also useful when the operational requirement is expressed as a startup
deadline: for example, "try to become ready for about 30 seconds, then fail
startup clearly."

## When not to use it

Do not use this as an ongoing health-check or supervision loop. This recipe is
about a startup gate before the application begins serving work.

Do not retry failures that prove startup is misconfigured. Bad credentials,
invalid hosts, missing schemas, incompatible versions, and authorization
failures should usually fail startup immediately.

Do not treat `Schedule.during` as a hard timeout for an in-flight readiness
attempt. It is checked at retry decision points; it does not interrupt a check
that is already running.

## Schedule shape

`Schedule.exponential("200 millis")` is an unbounded backoff schedule. With the
default factor of `2`, the retry delays are 200 milliseconds, 400 milliseconds,
800 milliseconds, 1.6 seconds, and so on.

`Schedule.during("30 seconds")` supplies the elapsed retry window. It recurs
while its elapsed schedule time is less than or equal to 30 seconds. By itself,
it contributes no meaningful delay.

`Schedule.both` combines the two schedules with intersection semantics:

- both schedules must want to continue
- the delay between retries is the maximum of the two schedule delays
- the output is a tuple of the exponential delay and the elapsed duration

In this policy, the exponential schedule controls the retry delay. The
`during` schedule controls when the policy stops.

With `Effect.retry`, the readiness check runs once immediately. Each typed
failure is fed to the schedule. If both schedules continue, `Effect.retry`
sleeps for the exponential delay and tries the readiness check again. If the
elapsed retry window has closed, retrying stops and the last typed failure is
returned.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DependencyNotReady extends Data.TaggedError("DependencyNotReady")<{
  readonly dependency: string
  readonly detail: string
}> {}

declare const waitForDatabase: Effect.Effect<void, DependencyNotReady>
declare const startApplication: Effect.Effect<void>

const startupReadinessPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

const program = Effect.gen(function*() {
  yield* waitForDatabase.pipe(
    Effect.retry(startupReadinessPolicy)
  )

  yield* startApplication
})
```

`program` checks the database once immediately. If the database is not ready,
the retry policy waits 200 milliseconds before the first retry, then 400
milliseconds, then 800 milliseconds, and continues backing off while the
30-second startup retry window remains open.

If a readiness attempt succeeds, `Effect.retry` stops immediately and
`startApplication` runs. If the readiness check is still failing after the
schedule stops, `program` fails with the last `DependencyNotReady`.

## Variants

Use a gentler backoff when the dependency usually takes longer to become ready:

```ts
const slowerStartupReadinessPolicy = Schedule.exponential("500 millis", 1.5).pipe(
  Schedule.both(Schedule.during("2 minutes"))
)
```

This starts with a 500 millisecond delay, grows by a factor of 1.5, and keeps
retrying while the 2-minute startup retry window is open.

When the readiness effect can fail with retryable and non-retryable startup
errors, keep the deadline schedule and add a retry predicate:

```ts
class DependencyMisconfigured extends Data.TaggedError("DependencyMisconfigured")<{
  readonly dependency: string
  readonly detail: string
}> {}

type StartupDependencyError = DependencyNotReady | DependencyMisconfigured

declare const waitForCache: Effect.Effect<void, StartupDependencyError>

const cacheProgram = waitForCache.pipe(
  Effect.retry({
    schedule: startupReadinessPolicy,
    while: (error) => error._tag === "DependencyNotReady"
  })
)
```

`cacheProgram` retries only the "not ready yet" case. A misconfiguration failure
does not spend the startup deadline; it stops retrying immediately.

Add a retry count when the startup deadline should also have an attempt budget:

```ts
const deadlineWithAttemptBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(12))
)
```

This retries while both bounds hold: the elapsed retry window is still open and
no more than 12 retries have been scheduled after the original attempt.

## Notes and caveats

`Schedule.during(duration)` measures the elapsed recurrence window for the
schedule. In a retry policy, that window is checked after typed failures, when
the schedule decides whether another retry is allowed.

`Schedule.during` is not a hard wall-clock timeout for startup. It does not
interrupt the initial readiness attempt, and it does not interrupt an attempt
that is already running. If an individual readiness call can hang, put a
timeout around that readiness call as a separate concern.

Because `Schedule.during` is checked before the next retry delay is slept, a
retry may be scheduled near the end of the window and begin after the nominal
duration. Use it as a retry-window deadline, not as a strict process deadline.

`Schedule.both` uses the maximum delay from its two sides. Here
`Schedule.during` contributes a zero delay, so the delay still comes from
`Schedule.exponential`.

The combined schedule output is a tuple containing the exponential delay and
the elapsed duration. Plain `Effect.retry` uses that output for timing and
stopping; the successful value is still the value produced by the readiness
effect.
