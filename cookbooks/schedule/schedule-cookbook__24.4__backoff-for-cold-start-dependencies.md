---
book: Effect `Schedule` Cookbook
section_number: "24.4"
section_title: "Backoff for cold-start dependencies"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "24. Exponential Backoff Recipes"
status: "draft"
code_included: true
---

# 24.4 Backoff for cold-start dependencies

Cold-start checks need to be responsive when dependencies are ready and gentle
when they are not. During deploys or scale-out, many instances may be opening
pools, loading config, warming caches, and contacting dependencies at the same
time.

Use exponential backoff for startup readiness checks. The first check happens
immediately; repeated failures quickly become less aggressive so cold
dependencies are not hit with a tight retry loop.

## Problem

Your application has a startup readiness check for a dependency such as a
database, cache, or local sidecar. That check should control whether the process
becomes ready or fails startup.

You want a policy that:

- runs the first readiness check immediately
- retries only transient readiness failures
- increases delay after each failed check
- stops after a clear startup budget
- optionally spreads instances apart with jitter

## When to use it

Use this recipe for idempotent startup gates. Good examples include pinging a
database, verifying that a cache endpoint accepts requests, checking that a
message broker connection can be opened, or asking a local dependency whether
it has completed its own initialization.

It is most useful during deploys, autoscaling, local development with multiple
services, test containers, and any environment where process start order does
not guarantee dependency readiness.

Use it when failure to become ready should fail startup. A bounded retry policy
is easier to operate than a process that stays alive but never reaches a useful
serving state.

## When not to use it

Do not retry configuration problems. Bad credentials, invalid URLs, missing
schemas, unsupported protocol versions, and authorization failures should fail
startup immediately.

Do not wrap the whole startup program in this policy. Retry the narrow
readiness check, not migrations, registration calls, background fiber startup,
or other steps that may have already succeeded.

Do not use backoff as a substitute for capacity planning. If every deploy
overloads the dependency for minutes, the schedule is revealing a system limit,
not solving it by itself.

## Schedule shape

`Schedule.exponential("200 millis")` waits 200 milliseconds before the first
retry, then 400 milliseconds, 800 milliseconds, 1.6 seconds, and so on. The
default factor is `2`.

`Schedule.recurs(8)` allows eight retries after the original attempt. Combined
with `Schedule.both`, the policy continues only while both schedules continue:
the exponential schedule supplies the delay, and the recurrence schedule
supplies the retry budget.

`Schedule.jittered` is useful for fleet startup. It randomly adjusts each
computed delay to between 80% and 120% of the original delay, so many instances
that fail at the same time are less likely to retry at exactly the same moment.

The shape is:

- attempt 1: check readiness immediately
- retry 1: wait about 200 milliseconds
- retry 2: wait about 400 milliseconds
- retry 3: wait about 800 milliseconds
- later retries: keep doubling
- after eight retries: return the last readiness failure

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DependencyNotReady extends Data.TaggedError("DependencyNotReady")<{
  readonly dependency: string
  readonly reason: string
}> {}

class DependencyMisconfigured extends Data.TaggedError("DependencyMisconfigured")<{
  readonly dependency: string
  readonly reason: string
}> {}

type StartupDependencyError = DependencyNotReady | DependencyMisconfigured

declare const checkDatabaseReady: Effect.Effect<void, StartupDependencyError>
declare const startHttpServer: Effect.Effect<void>

const coldStartBackoff = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(8)),
  Schedule.jittered
)

const isRetryableStartupFailure = (error: StartupDependencyError) =>
  error._tag === "DependencyNotReady"

export const program = Effect.gen(function*() {
  yield* checkDatabaseReady.pipe(
    Effect.retry({
      schedule: coldStartBackoff,
      while: isRetryableStartupFailure
    })
  )

  yield* startHttpServer
})
```

The readiness check runs once before the schedule is consulted. If it succeeds,
startup continues immediately. If it fails with `DependencyNotReady`, the retry
policy waits with jittered exponential backoff before checking again. If it
fails with `DependencyMisconfigured`, the `while` predicate stops retrying and
the error is returned.

## Variants

For a single local development process, remove jitter if deterministic timing is
more helpful than fleet smoothing:

```ts
const localStartupBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

For large fleet rollouts, keep jitter and use a slower base delay or gentler
growth factor so each instance gives the dependency more room:

```ts
const fleetStartupBackoff = Schedule.exponential("500 millis", 1.5).pipe(
  Schedule.both(Schedule.recurs(10)),
  Schedule.jittered
)
```

For dependencies with a strict startup service-level objective, use a smaller
retry count and let orchestration restart or reschedule the process after a
clear failure.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. The successful value of
`checkDatabaseReady` is returned when a retry eventually succeeds; the schedule
output is used for decisions and timing.

`Schedule.recurs(8)` means eight retries after the original readiness check,
not eight total checks.

Backoff reduces startup storms because each failed instance waits longer before
asking again. Jitter reduces synchronization between instances. The two address
different parts of the same operational problem, so they are often used
together during fleet startup.
