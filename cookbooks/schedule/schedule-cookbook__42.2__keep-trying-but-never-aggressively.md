---
book: Effect `Schedule` Cookbook
section_number: "42.2"
section_title: "“Keep trying, but never aggressively”"
part_title: "Part IX — Composition Recipes"
chapter_title: "42. Express Operational Intent Through Composition"
status: "draft"
code_included: true
---

# 42.2 “Keep trying, but never aggressively”

Some work should keep trying for as long as the process is alive, but it should
never turn a failure into pressure on an already weak dependency. Use a slow
`Schedule.spaced` cadence when persistence matters more than fast recovery:

```ts
const lowPressureRetry = Schedule.spaced("30 seconds").pipe(
  Schedule.jittered
)
```

Read that as: after each retryable failure, wait about 30 seconds before trying
again. `Schedule.jittered` keeps the delay near that cadence while preventing a
fleet of workers from retrying at exactly the same instant.

## Problem

Apply this shape to background work such as refreshing a cache, reconnecting to
a secondary service, resending an idempotent notification, or checking whether a
dependency has come back.

The policy should make three facts visible:

- retryable failures may be retried indefinitely
- every retry leaves a deliberate pause
- non-retryable failures still stop immediately

## When to use it

Use this recipe for non-interactive workflows where eventual recovery is useful
and latency is not the primary concern. It is a good fit for background workers,
maintenance loops, cache warmers, telemetry delivery, and other idempotent work
that should continue quietly after transient outages.

Use it when the operational requirement sounds like "keep trying in the
background" or "do not page someone just because the dependency was unavailable
for a while."

## When not to use it

Do not use this for user-facing requests that need a timely answer. A persistent
retry policy can leave the caller waiting forever unless the surrounding effect
has its own timeout or cancellation boundary.

Do not use it to retry permanent failures. Invalid configuration, malformed
input, missing authorization, and unsafe non-idempotent writes should be
classified before this schedule is applied.

Do not use a short spacing just because the schedule is simple. If the work is
allowed to continue forever, the delay should be generous enough to be safe
during an extended outage.

## Schedule shape

`Schedule.spaced("30 seconds")` recurs indefinitely and waits 30 seconds between
recurrence decisions. With `Effect.retry`, the first execution of the effect is
still immediate; the schedule controls only the retries after failures.

`Schedule.jittered` adjusts each computed delay to a random value between 80%
and 120% of the original delay. For a 30 second base cadence, retries happen
roughly between 24 and 36 seconds apart. That keeps the policy low pressure
while avoiding synchronized retries across many workers.

There is intentionally no `Schedule.recurs` or `Schedule.during` in the base
policy. Persistence is the point of this recipe. The stopping condition belongs
to error classification, shutdown, cancellation, or a separate business rule.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DeliveryError extends Data.TaggedError("DeliveryError")<{
  readonly reason: "Network" | "Unavailable" | "BadRecipient" | "InvalidPayload"
}> {}

declare const deliverNotification: Effect.Effect<void, DeliveryError>

const isRecoverable = (error: DeliveryError) =>
  error.reason === "Network" || error.reason === "Unavailable"

const lowPressureRetry = Schedule.spaced("30 seconds").pipe(
  Schedule.jittered
)

export const program = deliverNotification.pipe(
  Effect.retry({
    schedule: lowPressureRetry,
    while: isRecoverable
  })
)
```

The first delivery attempt runs immediately. If it fails with `Network` or
`Unavailable`, the program waits roughly 30 seconds and tries again. It keeps
doing that while the process remains alive and the failures are recoverable.

If the delivery succeeds, `program` succeeds. If the error is `BadRecipient` or
`InvalidPayload`, the retry predicate returns `false` and `program` fails with
that error instead of spending more time on a permanent problem.

## Variants

Use a longer spacing when the dependency is shared or expensive:

```ts
const veryLowPressureRetry = Schedule.spaced("5 minutes").pipe(
  Schedule.jittered
)
```

Add an elapsed budget only when persistence is no longer the requirement:

```ts
const lowPressureForOneHour = Schedule.spaced("30 seconds").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("1 hour"))
)
```

That variant still retries gently, but it stops once the schedule's elapsed
window is closed.

Use an exponential policy when fast early recovery matters:

```ts
const gentleStartupRetry = Schedule.exponential("500 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("2 minutes"))
)
```

That is a different operational promise: it tries sooner at first, then backs
off, and eventually gives up.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. The `while` predicate is where
this recipe separates recoverable operational failures from permanent domain
failures.

`Schedule.spaced` waits after a failed attempt completes. It does not place a
timeout on an attempt that is already running. Add a timeout to
`deliverNotification` itself if each attempt needs a maximum duration.

Because this policy can retry forever, observability matters. Log or metric the
failure near the effect being retried, but keep the schedule focused on the
recurrence policy: low-pressure spacing, jitter, and no artificial retry count.
