---
book: Effect `Schedule` Cookbook
section_number: "6.4"
section_title: "Backoff for startup dependency readiness"
part_title: "Part II — Core Retry Recipes"
chapter_title: "6. Retry with Exponential Backoff"
status: "draft"
code_included: true
---

# 6.4 Backoff for startup dependency readiness

This recipe uses exponential backoff as a bounded startup gate for dependencies that
may become ready shortly after the application starts. The schedule controls the retry
timing, while the surrounding Effect code remains responsible for deciding which
readiness failures should keep startup waiting.

## Problem

The database process may accept connections a few seconds after the app process
starts, a cache may still be warming, or a local service may be behind its own
startup sequence. You need startup to wait briefly for this readiness gap
without retrying forever.

You want the first readiness check to run immediately, then retry with growing
delays so startup gives the dependency time to become available without sending
a tight loop of connection attempts.

Use `Schedule.exponential` with `Effect.retry`, and bound the startup window with
`Schedule.recurs`.

## When to use it

Use this recipe when startup should wait briefly for a dependency that is
expected to become ready soon. It fits idempotent readiness checks such as
opening a connection, pinging a service, or verifying that a required endpoint
accepts requests.

It is most useful when the dependency and the application start together, such
as in local development, tests, containers, or deployment environments where
process ordering is not a readiness guarantee.

Use a bounded policy when the process should eventually fail startup instead of
waiting forever. A clear startup failure is usually easier to diagnose than a
process that appears alive but never finishes booting.

## When not to use it

Do not use this as a general health-check orchestration mechanism. This recipe
is about one startup gate before the application begins serving work, not
ongoing runtime supervision.

Do not retry failures that mean the dependency is configured incorrectly. Bad
credentials, invalid host names, missing schemas, and authorization errors
usually need to fail startup immediately.

Do not wrap non-idempotent setup work in this policy. If a startup step creates
tables, runs migrations, publishes messages, or registers external state, make
that step safe to repeat before retrying it.

## Schedule shape

`Schedule.exponential("200 millis")` keeps recurring and increases the delay
after each typed failure. With the default factor of `2`, the delay sequence is
200 milliseconds, 400 milliseconds, 800 milliseconds, 1.6 seconds, and so on.

`Schedule.recurs(8)` supplies the retry budget. It allows eight retries after
the original attempt. Combining the two schedules with `Schedule.both` means
both policies must still continue. `Schedule.both` uses the maximum delay from
the two schedules; here the recurrence schedule contributes no delay, so the
exponential delay is the one that matters. The recurrence schedule stops the
policy after the retry budget is exhausted.

The shape is:

- attempt 1: run the readiness check immediately
- if it fails with a typed readiness error: wait 200 milliseconds
- attempt 2: run the readiness check again
- subsequent retry delays: 400 milliseconds, 800 milliseconds, 1.6 seconds, 3.2
  seconds, 6.4 seconds, 12.8 seconds, 25.6 seconds
- if the ninth total attempt still fails: propagate the last typed failure

If any attempt succeeds, `Effect.retry` stops immediately and returns the
successful value from the readiness check.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DependencyNotReady extends Data.TaggedError("DependencyNotReady")<{
  readonly dependency: string
  readonly detail: string
}> {}

declare const waitForDatabase: Effect.Effect<void, DependencyNotReady>
declare const startApplication: Effect.Effect<void>

const startupDependencyBackoff = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(8))
)

const program = Effect.gen(function*() {
  yield* waitForDatabase.pipe(
    Effect.retry(startupDependencyBackoff)
  )

  yield* startApplication
})
```

`program` checks the database once immediately. If the check fails with
`DependencyNotReady`, it retries with exponential backoff. If the dependency
becomes ready during the retry window, startup continues to `startApplication`.
If every permitted attempt fails, the final `DependencyNotReady` is propagated.

## Variants

Use a different base duration or factor when the dependency usually needs a
slower warm-up:

```ts
const slowerStartupBackoff = Schedule.exponential("500 millis", 1.5).pipe(
  Schedule.both(Schedule.recurs(10))
)
```

The first retry waits 500 milliseconds, then 750 milliseconds, then 1.125
seconds, and continues growing by the same factor until the retry budget is
exhausted.

When the readiness effect can fail with both retryable and non-retryable startup
errors, add a `while` predicate to the retry options:

```ts
class DependencyMisconfigured extends Data.TaggedError("DependencyMisconfigured")<{
  readonly dependency: string
  readonly detail: string
}> {}

type StartupDependencyError = DependencyNotReady | DependencyMisconfigured

declare const waitForCache: Effect.Effect<void, StartupDependencyError>

const isStillStarting = (error: StartupDependencyError) => error._tag === "DependencyNotReady"

const cacheProgram = waitForCache.pipe(
  Effect.retry({
    schedule: startupDependencyBackoff,
    while: isStillStarting
  })
)
```

This retries only `DependencyNotReady`. A `DependencyMisconfigured` failure stops
retrying immediately and is returned to the caller.

## Notes and caveats

`Schedule.exponential` does not delay the first attempt. The first readiness
check runs immediately; only retry attempts are delayed.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts. In this recipe that allows up to nine readiness checks.

The combined schedule output is a tuple containing the exponential delay output
and the recurrence count. Plain `Effect.retry` uses the schedule for retry
decisions and timing, then returns the successful value of the original effect.

Keep the retry boundary narrow. Retry the readiness check itself, not the whole
startup workflow, so initialization steps that already succeeded are not run
again.
