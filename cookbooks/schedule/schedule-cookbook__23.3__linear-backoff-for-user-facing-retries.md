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

Linear backoff is a fit for interactive retries when the caller can wait
briefly, but only within a small budget. Each later retry becomes a little more
conservative without jumping to long delays.

Effect does not provide a `Schedule.linear` constructor. Build the shape from
`Schedule.unfold`, then derive the delay with `Schedule.addDelay`.

## Problem

A request handler loads data for an interactive screen and may fail with typed
transient errors: a brief network issue, a warm cache miss, or a dependency that
is momentarily busy.

Use a small linear retry policy:

- first retry waits 150 milliseconds
- second retry waits 300 milliseconds
- third retry waits 450 milliseconds
- permanent errors skip the schedule entirely

The first attempt still runs immediately. The schedule only decides what happens
after a typed failure.

## When to use it

Use this recipe for interactive operations where a short retry window improves
the experience without hiding the final result for too long: loading a profile,
refreshing a dashboard panel, submitting a duplicate-safe form action, or
calling a service that occasionally returns a typed "busy" signal.

The operation must be safe to retry. For a write, that usually means an
idempotency key, conditional update, or server-side deduplication. If repeating
the operation can charge a card twice, send two emails, or publish duplicate
events, do not wrap the whole workflow in a retry schedule.

## When not to use it

Do not retry validation failures, authorization failures, missing required
fields, malformed requests, or business-rule rejections. Those are not made more
correct by waiting.

Do not use a long user-facing retry ladder to mask an unhealthy dependency. Give
the caller a clear failure and move slower recovery work to a background process
or queue.

For fleet-wide retries from many clients, deterministic linear delays can still
line up. Add jitter after the base timing is correct, or move the retry closer
to the service boundary where it can be coordinated.

## Schedule shape

`Schedule.unfold(1, ...)` emits the current step and advances to the next step.
`Schedule.addDelay` converts that step into a delay. Multiplying by a base
interval produces a linear sequence: `150ms`, `300ms`, `450ms`, and so on.

Keep a separate retry budget so the user does not wait through an unbounded
sequence. `Schedule.both` combines the timing policy with the count policy; the
combined schedule continues only while both schedules continue.

With `Effect.retry`, failures are passed to the schedule. The `while` predicate
keeps permanent failures from consuming the user-facing retry budget.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

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

declare const loadDashboard: Effect.Effect<ReadonlyArray<string>, LoadError>

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
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 150)))
)

const userFacingRetry = linearDelay.pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = loadDashboard.pipe(
  Effect.retry({
    schedule: userFacingRetry,
    while: isRetryable
  })
)
```

`program` runs `loadDashboard` immediately. If it fails with `ServiceBusy` or
`NetworkGlitch`, the retry waits according to the linear delay and stops after
the small retry budget is spent. If it fails with `InvalidSession`, the error is
returned immediately.

## Variants

For a tighter interface budget, reduce both the base delay and retry count:

```ts
const quickUiRetry = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 75))),
  Schedule.both(Schedule.recurs(2))
)
```

For a form submission, keep the schedule around the smallest idempotent effect:
for example, retry the request protected by an idempotency key, not the entire
flow that also updates local state, records analytics, and sends notifications.

For many clients or browser tabs retrying at the same time, apply
`Schedule.jittered` after the linear timing is correct:

```ts
const jitteredUserFacingRetry = userFacingRetry.pipe(
  Schedule.jittered
)
```

## Notes and caveats

`Schedule.addDelay` adds to the delay produced by the schedule it wraps.
`Schedule.unfold` produces zero delay on its own, so in this recipe the added
delay is the effective wait.

`Effect.retry` retries typed failures from the error channel. Defects,
interruptions, and failures filtered out by the `while` predicate are not turned
into scheduled retries.

Keep user-facing policies short enough to explain in product terms. "Try again
a few times over about a second" is usually a better interface contract than a
large retry ladder whose worst-case latency is hard to justify.
