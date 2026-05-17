---
book: Effect `Schedule` Cookbook
section_number: "23.3"
section_title: "Linear backoff for user-facing retries"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.3 Linear backoff for user-facing retries

User-facing retries need a small budget. Linear backoff gives each later retry a
little more space while keeping the worst-case wait easy to explain.

Effect does not provide `Schedule.linear`; model the step with `Schedule.unfold`
and derive the delay with `Schedule.addDelay`.

## Problem

An interactive screen loads data from a dependency that can be briefly busy. The
policy should:

- run the first attempt immediately
- retry transient failures with short linear delays
- stop after a few retries
- return permanent failures without waiting

For example, a 150 millisecond step gives `150ms`, `300ms`, and `450ms` before
the first three retries.

## When to use it

Use this for profile loads, dashboard panels, duplicate-safe form submissions,
or service calls that occasionally return a typed "busy" or transient network
failure.

For writes, require an idempotency key, conditional update, or server-side
deduplication. A retry schedule controls timing; it does not prevent duplicate
charges, emails, or events.

## When not to use it

Do not retry validation failures, missing required fields, invalid sessions, or
business-rule rejections. Do not hide a long outage behind a slow user-facing
retry ladder; fail clearly and move longer recovery into a background process.

## Schedule shape

`Schedule.unfold(1, ...)` emits the retry step. `Schedule.addDelay` turns the
step into a duration. `Schedule.both(Schedule.recurs(3))` adds a separate retry
limit, so the delay calculation and the budget are visible independently.

With `Effect.retry`, the `while` predicate sees the typed failure and decides
whether the schedule should run for that error.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class ServiceBusy extends Data.TaggedError("ServiceBusy")<{
  readonly service: string
}> {}

class NetworkGlitch extends Data.TaggedError("NetworkGlitch")<{
  readonly requestId: string
}> {}

class InvalidSession extends Data.TaggedError("InvalidSession")<{
  readonly userId: string
}> {}

type LoadError = ServiceBusy | NetworkGlitch | InvalidSession

let attempts = 0

const loadDashboard = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`dashboard attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail(new ServiceBusy({ service: "profile-api" }))
  }
  if (attempts === 2) {
    return yield* Effect.fail(new NetworkGlitch({ requestId: "req-42" }))
  }

  return ["inbox", "notifications", "billing"] as const
})

const isRetryable = (error: LoadError): boolean => {
  switch (error._tag) {
    case "ServiceBusy":
    case "NetworkGlitch":
      return true
    case "InvalidSession":
      return false
  }
}

const linearDelay = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 20)))
)

const userFacingRetry = linearDelay.pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = Effect.gen(function*() {
  const sections = yield* loadDashboard.pipe(
    Effect.retry({
      schedule: userFacingRetry,
      while: isRetryable
    })
  )
  yield* Console.log(`loaded sections: ${sections.join(", ")}`)
}).pipe(
  Effect.catch((error) => Console.log(`dashboard failed: ${error._tag}`))
)

Effect.runPromise(program)
```

The example uses 20 millisecond steps. In an HTTP handler, choose the step and
retry count from the latency budget the caller can tolerate.

## Variants

For a tighter interface budget, reduce both the base delay and retry count. For
many browser tabs, clients, or workers retrying together, apply
`Schedule.jittered` after the linear timing is correct.

For form submission, place the retry around the idempotent request, not around
the broader flow that updates local state, records analytics, and sends
notifications.

## Notes and caveats

`Effect.retry` retries typed failures from the error channel. Defects,
interruptions, and failures filtered out by the `while` predicate are not turned
into scheduled retries.

Keep the contract short enough to describe in product terms: "try a few times
over about a second" is usually clearer than a long ladder with unclear
worst-case latency.
