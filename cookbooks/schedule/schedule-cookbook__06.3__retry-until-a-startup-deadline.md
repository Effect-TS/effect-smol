---
book: "Effect `Schedule` Cookbook"
section_number: "6.3"
section_title: "Retry until a startup deadline"
part_title: "Part II — Retry Recipes"
chapter_title: "6. Retry Budgets and Deadlines"
status: "draft"
code_included: true
---

# 6.3 Retry until a startup deadline

Use this for startup gates that should wait briefly for a required dependency
before the process begins serving traffic.

## Problem

Retry a readiness check with exponential backoff while a startup retry window
remains open. If readiness succeeds, startup continues. If the window closes,
startup fails with the last typed readiness error.

## When to use it

Use this for databases, caches, queues, service endpoints, or local companion
processes that often become reachable shortly after the application starts.

The readiness effect should be safe to repeat: a ping, connection probe, or
idempotent "are you ready?" call.

## When not to use it

Do not use this as an ongoing health check or supervisor loop. This recipe is a
startup gate.

Do not retry failures that prove startup is misconfigured, such as bad
credentials, invalid hosts, missing schemas, incompatible versions, or
authorization failures.

Do not treat `Schedule.during` as a hard process deadline. It does not
interrupt a readiness attempt that is already running.

## Schedule shape

`Schedule.exponential("200 millis")` supplies delays of 200 milliseconds, 400
milliseconds, 800 milliseconds, and so on.

`Schedule.during("30 seconds")` supplies the startup retry window. In a retry
policy, the window is checked after typed failures when the schedule decides
whether another retry is allowed.

`Schedule.both` gives intersection semantics: both schedules must continue,
and the retry delay is the maximum of their delays. Here that means backoff
controls waiting and `during` controls when retry scheduling stops.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class DependencyNotReady extends Data.TaggedError("DependencyNotReady")<{
  readonly dependency: string
  readonly detail: string
}> {}

class DependencyMisconfigured extends Data.TaggedError("DependencyMisconfigured")<{
  readonly dependency: string
  readonly detail: string
}> {}

type StartupDependencyError = DependencyNotReady | DependencyMisconfigured

let checks = 0

const waitForDatabase: Effect.Effect<void, StartupDependencyError> = Effect.gen(function*() {
  checks += 1
  yield* Console.log(`database readiness check ${checks}`)

  if (checks < 3) {
    return yield* Effect.fail(
      new DependencyNotReady({
        dependency: "database",
        detail: "connection refused"
      })
    )
  }
})

const startApplication = Console.log("application started")

const startupReadinessPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

const program = Effect.gen(function*() {
  yield* waitForDatabase.pipe(
    Effect.retry({
      schedule: startupReadinessPolicy,
      while: (error) => error._tag === "DependencyNotReady"
    })
  )

  yield* startApplication
})

Effect.runPromise(program)
```

`DependencyMisconfigured` would stop retrying immediately. It is a permanent
startup failure, not a readiness delay.

## Variants and caveats

Use a gentler policy such as `Schedule.exponential("500 millis", 1.5).pipe(Schedule.both(Schedule.during("2 minutes")))`
when a dependency commonly needs longer to become ready.

Add `Schedule.recurs(12)` with another `Schedule.both` when startup should also
have an attempt cap.

If an individual readiness call can hang, put a timeout around that call. The
schedule bounds retry decisions; it does not cancel work already in progress.
