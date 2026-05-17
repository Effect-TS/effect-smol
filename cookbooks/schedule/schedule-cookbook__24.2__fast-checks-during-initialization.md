---
book: "Effect `Schedule` Cookbook"
section_number: "24.2"
section_title: "Fast checks during initialization"
part_title: "Part VI — Composition and Termination"
chapter_title: "24. Multi-Phase Policies"
status: "draft"
code_included: true
---

# 24.2 Fast checks during initialization

Fast initialization checks are for dependencies that usually become ready
quickly. Keep the cadence and limits visible so the startup loop stays bounded.

## Problem

At startup, database and broker checks may fail with `DependencyUnavailable`
while connections finish opening. Retry only that transient condition, and make
the policy answer three questions directly:

- how long to wait between checks
- how many follow-up checks are allowed
- how much startup time the check may consume

Without an explicit schedule, these rules tend to disappear into ad hoc sleeps
and counters.

## When to use it

Use this recipe for initialization checks that are expected to settle quickly:
opening a connection pool, checking a local sidecar, validating that a required
topic exists, or confirming a warm cache is reachable.

The check must be safe to run more than once. It should observe readiness or
perform idempotent setup, not repeat a write that could create duplicate work.

## When not to use it

Do not use a fast startup schedule for steady-state monitoring. Once the
service is running, switch to a slower runtime schedule so health checks do not
create constant pressure.

Do not retry permanent configuration failures. Missing credentials, malformed
connection strings, unsupported schema versions, and authorization failures
should fail startup immediately.

Do not treat the schedule as a hard timeout for an individual check.
`Schedule.during("2 seconds")` is evaluated at recurrence decision points. Add
a timeout to the check itself if one probe must not run too long.

## Schedule shape

Combine a fast cadence with a retryable-error predicate, a count limit, and a
short elapsed budget.

`Schedule.spaced("100 millis")` waits briefly after each failed check.
`Schedule.while` prevents retries for permanent startup errors.
`Schedule.recurs(12)` allows at most twelve follow-up attempts.
`Schedule.during("2 seconds")` stops recurrence once the startup budget has
been used.

The `both` combinator gives intersection semantics: the retry continues only
while all pieces of the policy still allow another recurrence.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type StartupCheckError =
  | { readonly _tag: "DependencyUnavailable"; readonly dependency: string }
  | { readonly _tag: "InvalidConfiguration"; readonly message: string }

let databaseChecks = 0

const checkDatabase: Effect.Effect<void, StartupCheckError> = Effect.gen(function*() {
  databaseChecks += 1
  yield* Console.log(`database check ${databaseChecks}`)
  if (databaseChecks < 3) {
    return yield* Effect.fail({
      _tag: "DependencyUnavailable",
      dependency: "database"
    })
  }
})

const checkMessageBroker: Effect.Effect<void, StartupCheckError> = Console.log("broker check ok")

const startupChecks = Effect.fnUntraced(function*() {
  yield* checkDatabase
  yield* checkMessageBroker
})

const fastInitializationChecks = Schedule.spaced("20 millis").pipe(
  Schedule.satisfiesInputType<StartupCheckError>(),
  Schedule.while(({ input }) => input._tag === "DependencyUnavailable"),
  Schedule.both(Schedule.recurs(12)),
  Schedule.both(
    Schedule.during("200 millis").pipe(
      Schedule.satisfiesInputType<StartupCheckError>()
    )
  )
)

const initialize = startupChecks().pipe(
  Effect.retry(fastInitializationChecks)
)

const program = Effect.gen(function*() {
  yield* initialize
  yield* Console.log("initialized")
})

Effect.runPromise(program)
```

`initialize` runs the first startup check immediately. If a dependency is not
available yet, it retries while the count and elapsed limits both still allow
another attempt. If the check fails with
`InvalidConfiguration`, the schedule stops and the original failure is returned.

## Variants

For a purely local readiness check, reduce the delay and count, for example
`Schedule.spaced("25 millis").pipe(Schedule.both(Schedule.recurs(8)))`.
Keep the elapsed budget short so startup failure is reported quickly.

For startup across many replicas, add `Schedule.jittered` after the cadence is
correct. Jitter spreads retries so a fleet does not hit the same dependency in
lockstep during a rollout.

For checks that may hang, place `Effect.timeout` on the checked effect before
`Effect.retry`. The timeout bounds one probe; the schedule bounds the retry
window.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. That is why the error type is
made explicit with `Schedule.satisfiesInputType<StartupCheckError>()` before
reading `metadata.input` in `Schedule.while`.

The schedule does not delay the first check. It only decides whether to perform
another check after a failure.

The elapsed budget is checked between attempts. Time spent inside each startup
check contributes to the elapsed schedule time before the next recurrence
decision, but the schedule does not interrupt an in-flight check.
