---
book: Effect `Schedule` Cookbook
section_number: "21.2"
section_title: "Constant delays"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "21. Choosing a Delay Strategy"
status: "draft"
code_included: true
---

# 21.2 Constant delays

A constant delay is the simplest useful delay strategy: wait the same amount of
time before each retry or repeated iteration. It is a good default when the
dependency is normally stable, failures are brief, and you want predictable
behavior without the operational complexity of backoff.

Use it deliberately. A constant delay makes load easy to reason about, but it
does not reduce pressure over time. If the dependency is overloaded, rate
limited, or shared by many coordinated clients, prefer backoff, jitter, or a
larger external rate limit.

## Problem

You need to retry a transient failure without hammering the dependency and
without making the policy adaptive. Immediate retries are too aggressive, but
exponential backoff would be more machinery than the situation needs.

The policy should say two things clearly:

- how long to wait between attempts
- when to stop retrying

## When to use it

Use a constant delay for stable dependencies that occasionally return temporary
failures: a local service restarting, a short network hiccup, a lock that clears
quickly, or an idempotent request to a dependency that normally recovers within
a few seconds.

It is also useful as a conservative first production policy. The delay is easy
to explain in logs and dashboards, and changing `"250 millis"` to `"1 second"`
does not change the shape of the schedule.

## When not to use it

Do not use a constant delay as the only protection for overload. If every retry
waits the same amount of time, a busy caller can keep applying steady pressure
to a dependency that is already failing.

Do not use it without a stop condition unless the workflow is intentionally
unbounded. `Schedule.spaced("1 second")` by itself keeps recurring forever.

Do not use it for unsafe side effects. Retrying writes requires idempotency,
deduplication, or a domain-specific recovery plan before the schedule is chosen.

## Schedule shape

For retrying with a constant delay, start with `Schedule.spaced(duration)` and
combine it with a limit:

```ts
import { Effect, Schedule } from "effect"

type TemporaryError = { readonly _tag: "TemporaryError" }

declare const fetchProfile: Effect.Effect<string, TemporaryError>

const retryWithConstantDelay = Schedule.spaced("500 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

export const program = fetchProfile.pipe(
  Effect.retry(retryWithConstantDelay)
)
```

This means the first `fetchProfile` attempt runs immediately. If it fails with a
typed error, Effect waits 500 milliseconds before the next attempt. The policy
allows up to four retries after the initial attempt.

`Schedule.spaced(duration)` waits that duration after each completed attempt
before allowing the next recurrence. Use this for ordinary retry spacing and
for repeat loops where the gap after work completes is what matters.

`Schedule.fixed(duration)` is different: it targets fixed interval boundaries.
That is useful for fixed-cadence repeating work, but it is usually not what you
mean by "wait 500 milliseconds before retrying." For retry policies, reach for
`spaced` first unless you specifically need clock-like cadence.

## Variants

For a user-facing request, keep both the delay and the retry count small so the
caller gets an answer quickly:

```ts
const retryBriefly = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)
```

For a background worker, increase the delay before increasing the retry count.
That keeps the policy simple while reducing pressure on the dependency.

If many instances run the same policy at the same time, a constant delay can
synchronize retries. Add jitter only after the base delay and retry limit are
correct.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. The first execution is
not delayed, and defects or interruptions are not retried as ordinary typed
failures.

The output of `Schedule.spaced` is a recurrence count. In a retry, that output
is used to drive the policy; the successful value of the retried effect is what
the program returns.

Keep classification close to the effect being retried. The schedule should
describe timing and limits, while the domain code decides which failures are
safe to retry.
