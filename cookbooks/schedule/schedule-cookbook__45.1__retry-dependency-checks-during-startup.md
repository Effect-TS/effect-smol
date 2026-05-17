---
book: Effect `Schedule` Cookbook
section_number: "45.1"
section_title: "Retry dependency checks during startup"
part_title: "Part X — Real-World Recipes"
chapter_title: "45. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 45.1 Retry dependency checks during startup

Startup dependency checks sit between process boot and readiness. They can
absorb short platform races, but they should not hide configuration or schema
failures.

## Problem

A service must prove that a required dependency is reachable before it marks
itself ready. DNS lookup failures, refused connections, and timeouts may clear
after a short wait. Bad credentials or schema mismatches should fail startup
immediately.

Use one retry policy for the dependency check, not for the whole boot sequence.
The policy should slow repeated failures, cap the number of retries, and keep
the total startup wait bounded.

## When to use it

Use this recipe for idempotent startup probes such as database connectivity,
cache reachability, message broker readiness, feature flag client
initialization, or a search cluster health check.

It fits services that have not opened traffic yet and can afford a short
readiness delay while still giving operators a clear failure when the dependency
does not recover.

## When not to use it

Do not retry permanent startup failures. Missing secrets, bad credentials,
invalid endpoints, incompatible schema versions, and malformed configuration
should fail startup immediately.

Do not put the whole boot sequence inside the retry. Keep the retry boundary
around the small dependency check. Initialization steps that create records,
run migrations, or perform writes need their own idempotency guarantees before
they are retried.

## Schedule shape

Start with `Schedule.exponential` for backoff. It does not stop by itself, so
combine it with `Schedule.recurs` for the retry count and `Schedule.during` for
the elapsed startup budget.

Use `Schedule.modifyDelay` with `Duration.min` when no individual sleep should
grow beyond a maximum. `Schedule.both` keeps the policy running only while both
sides still allow another retry; the backoff supplies the delay, and the count
and time schedules supply stopping conditions.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class DependencyCheckError extends Data.TaggedError("DependencyCheckError")<{
  readonly reason:
    | "DnsLookup"
    | "ConnectionRefused"
    | "Timeout"
    | "BadCredentials"
    | "SchemaMismatch"
}> {}

let attempts = 0

const checkDatabase = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`database check ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail(new DependencyCheckError({ reason: "DnsLookup" }))
  }
  if (attempts === 2) {
    return yield* Effect.fail(new DependencyCheckError({ reason: "Timeout" }))
  }

  yield* Console.log("database reachable")
})

const isRetryableStartupFailure = (error: DependencyCheckError) =>
  error.reason === "DnsLookup" ||
  error.reason === "ConnectionRefused" ||
  error.reason === "Timeout"

const startupDependencyPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(30)))
  ),
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("200 millis"))
)

const program = checkDatabase.pipe(
  Effect.retry({ schedule: startupDependencyPolicy, while: isRetryableStartupFailure }),
  Effect.flatMap(() => Console.log(`startup ready after ${attempts} checks`)),
  Effect.catch((error: DependencyCheckError) =>
    Console.log(`startup failed: ${error.reason}`)
  )
)

void Effect.runPromise(program)
```

The demo runs quickly by using millisecond delays. In production, use larger
values that match the orchestrator's readiness budget. The first dependency
check runs immediately; only follow-up attempts are scheduled.

## Variants

For a stricter container readiness path, reduce both the deadline and retry
count. For dependencies that commonly take longer during deploys, keep the first
retry quick but allow a longer total budget. If many instances start at the same
time, add `Schedule.jittered` before the delay cap so they do not retry on the
same boundaries.

## Notes and caveats

`Effect.retry` feeds each typed failure into the schedule after the effect
fails. The original startup check is not delayed.

`Schedule.exponential` controls the waits between retries. It is not a total
timeout. Pair it with `Schedule.recurs` and `Schedule.during` when startup must
either become ready or fail within a known budget.

The deadline here is a schedule deadline, not a timeout for a single check. If
one dependency check can hang, put an Effect timeout on that check before
retrying it.
