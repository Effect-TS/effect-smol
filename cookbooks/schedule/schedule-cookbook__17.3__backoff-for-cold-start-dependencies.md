---
book: "Effect `Schedule` Cookbook"
section_number: "17.3"
section_title: "Backoff for cold-start dependencies"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "17. Operational Backoff Recipes"
status: "draft"
code_included: true
---

# 17.3 Backoff for cold-start dependencies

Cold-start checks should be responsive when dependencies are ready and gentle
when they are not. During deploys or scale-out, many instances may open pools,
load config, warm caches, and contact dependencies at the same time.

## Problem

A startup readiness check controls whether the process becomes ready. It should
run immediately, retry only transient readiness failures, increase delay after
each failed check, and stop after a clear startup budget.

## When to use it

Use this for idempotent startup gates: pinging a database, checking a cache
endpoint, opening a broker connection, or asking a local sidecar whether it has
finished initialization.

It is most useful when process start order does not guarantee dependency
readiness: deploys, autoscaling, local multi-service development, and test
containers.

## When not to use it

Do not retry bad credentials, invalid URLs, missing schemas, unsupported
protocol versions, or authorization failures. Retry the narrow readiness check,
not the whole startup program.

If every deploy overloads the dependency for minutes, the schedule is exposing a
capacity problem rather than solving it.

## Schedule shape

`Schedule.exponential("200 millis")` waits 200 milliseconds before the first
retry, then 400 milliseconds, 800 milliseconds, and so on. Combine it with
`Schedule.recurs` for a startup budget. Use `Schedule.jittered` for fleet
startup so instances are less likely to retry at exactly the same moment.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class DependencyNotReady extends Data.TaggedError("DependencyNotReady")<{
  readonly dependency: string
  readonly reason: string
}> {}

class DependencyMisconfigured extends Data.TaggedError("DependencyMisconfigured")<{
  readonly dependency: string
  readonly reason: string
}> {}

type StartupDependencyError = DependencyNotReady | DependencyMisconfigured

let readinessChecks = 0

const checkDatabaseReady: Effect.Effect<void, StartupDependencyError> =
  Effect.gen(function*() {
    readinessChecks += 1
    yield* Console.log(`database readiness check ${readinessChecks}`)

    if (readinessChecks < 4) {
      return yield* Effect.fail(
        new DependencyNotReady({
          dependency: "postgres",
          reason: "accepting connections soon"
        })
      )
    }
  })

const startHttpServer = Console.log("HTTP server started")

const coldStartBackoff = Schedule.exponential("15 millis").pipe(
  Schedule.both(Schedule.recurs(5)),
  Schedule.jittered
)

const isRetryableStartupFailure = (error: StartupDependencyError) =>
  error._tag === "DependencyNotReady"

const program = Effect.gen(function*() {
  yield* checkDatabaseReady.pipe(
    Effect.retry({
      schedule: coldStartBackoff,
      while: isRetryableStartupFailure
    })
  )

  yield* startHttpServer
}).pipe(
  Effect.catch((error) => Console.log(`startup failed: ${error._tag}`))
)

Effect.runPromise(program)
```

The first readiness check runs before the schedule is consulted. If a retry
eventually succeeds, startup continues. If the failure is misconfiguration, the
`while` predicate prevents retrying.

## Variants

For a single local process, remove jitter when deterministic timing is more
useful. For large rollouts, keep jitter and use a slower base delay or gentler
growth factor. For dependencies with a strict startup service-level objective,
use a smaller retry count and let orchestration restart or reschedule the
process after failure.

## Notes and caveats

`Schedule.recurs(5)` means five retries after the original readiness check, not
five total checks.

Backoff reduces startup storms by waiting longer after each failure. Jitter
reduces synchronization between instances. They address different parts of the
same startup problem and are often used together.
