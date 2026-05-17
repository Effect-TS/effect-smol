---
book: "Effect `Schedule` Cookbook"
section_number: "5.4"
section_title: "Backoff for startup dependency readiness"
part_title: "Part II — Retry Recipes"
chapter_title: "5. Exponential and Capped Backoff"
status: "draft"
code_included: true
---

# 5.4 Backoff for startup dependency readiness

Startup often races with nearby services. A bounded exponential retry can wait
for a dependency to become ready without turning startup into an endless loop.

## Problem

A database may accept connections a few seconds after the app process starts,
or a local cache may still be warming. The app should wait briefly, with
increasing pauses, and then fail startup clearly if readiness never arrives.

## When to use it

Use this for idempotent readiness checks: opening a connection, pinging a
service, or verifying that a required endpoint accepts requests.

It fits local development, tests, containers, and deployments where process
ordering is not the same thing as dependency readiness.

## When not to use it

Do not retry misconfiguration. Bad credentials, invalid host names, missing
schemas, and authorization errors should usually fail startup immediately.

Do not wrap non-idempotent setup work in this policy. Migrations, table
creation, message publication, and external registration need their own
duplicate-safe design before they can be retried.

## Schedule shape

`Schedule.exponential("200 millis")` produces 200 millisecond, 400
millisecond, 800 millisecond, and 1.6 second delays with the default factor.

`Schedule.recurs(8)` allows eight retries after the original readiness check.
Combined with `Schedule.both`, the exponential schedule supplies the delay and
the recurrence schedule stops the policy after the retry budget is exhausted.

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class DependencyNotReady extends Data.TaggedError("DependencyNotReady")<{
  readonly dependency: string
  readonly attempt: number
}> {}

const waitForDatabase = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`database readiness attempt ${attempt}`)

  if (attempt < 4) {
    return yield* Effect.fail(
      new DependencyNotReady({ dependency: "database", attempt })
    )
  }
})

const startApplication = Console.log("application started")

const startupDependencyBackoff = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(8))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* Effect.gen(function*() {
    yield* waitForDatabase(attempts).pipe(
      Effect.retry(startupDependencyBackoff)
    )
    yield* startApplication
  }).pipe(Effect.forkScoped)

  yield* TestClock.adjust("200 millis")
  yield* TestClock.adjust("400 millis")
  yield* TestClock.adjust("800 millis")

  yield* Fiber.join(fiber)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The readiness check fails three times, backs off through 200, 400, and 800
milliseconds, then starts the application.

## Notes

The first readiness check runs immediately. Only retry attempts are delayed.

`Schedule.recurs(8)` means eight retries after the original attempt, so this
policy allows up to nine readiness checks.

Retry the readiness check itself, not the entire startup workflow. Initialization
steps that already succeeded should not be run again because a later dependency
probe failed.
