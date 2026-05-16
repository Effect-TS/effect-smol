---
book: Effect `Schedule` Cookbook
section_number: "37.5"
section_title: "Classify errors before retrying"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "37. Stop on Error Conditions"
status: "draft"
code_included: true
---

# 37.5 Classify errors before retrying

Retry policies should be narrow. A schedule can say when to try again and when
to stop, but it should not be asked to make every domain decision. Classify the
typed failure first, then let `Effect.retry` apply the schedule only to failures
that are genuinely transient.

## Problem

A downstream call can fail for several reasons. Some failures are temporary:
timeouts, overload, rate limits, or a service that is briefly unavailable. Other
failures are final for the current request: bad input, authorization failure,
missing configuration, or a business rule violation.

Using one broad retry policy for all of them delays permanent failures and adds
unnecessary load. The caller also loses a useful signal: whether the operation
failed because it was never retryable or because the retry budget was exhausted.

## When to use it

Use this pattern when the same effect can fail with both transient and
non-transient typed errors. It is a good fit for HTTP clients, database calls,
message brokers, cloud control planes, and service-to-service requests where a
small set of failures should be attempted again.

Keep the classification close to the effect that knows the domain. A predicate
such as `isTransient` is easier to review than a schedule that silently retries
every error it receives.

## When not to use it

Do not use this to make unsafe work safe to retry. A non-idempotent write still
needs an idempotency key, transaction boundary, deduplication strategy, or
another domain guarantee.

Do not retry validation errors, authentication errors, authorization errors,
malformed requests, or configuration errors. Those failures should return
immediately so the caller can fix the request or escalate the operational issue.

## Schedule shape

Use two separate pieces:

- a predicate that decides whether the typed failure is transient
- a bounded schedule that decides retry timing and termination

`Schedule.exponential("100 millis")` provides the backoff curve. By itself, it
is unbounded. `Schedule.recurs(4)` adds a maximum of four retries after the
original attempt. `Schedule.jittered` spreads retry attempts around the
exponential delay so multiple callers do not retry together.

With `Effect.retry({ schedule, while })`, the `while` predicate is checked for
the typed failure. If it returns `false`, retrying stops immediately and that
failure is returned. If it returns `true`, the failure is fed to the schedule,
which decides whether another retry is allowed and how long to wait.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DownstreamError extends Data.TaggedError("DownstreamError")<{
  readonly reason:
    | "Timeout"
    | "Unavailable"
    | "RateLimited"
    | "BadRequest"
    | "Unauthorized"
}> {}

declare const callDownstream: Effect.Effect<string, DownstreamError>

const isTransient = (error: DownstreamError) =>
  error.reason === "Timeout" ||
  error.reason === "Unavailable" ||
  error.reason === "RateLimited"

const retryTransientFailures = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

export const program = callDownstream.pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    while: isTransient
  })
)
```

`program` runs `callDownstream` once immediately. If it fails with
`BadRequest` or `Unauthorized`, retrying stops without consulting the backoff
policy. If it fails with `Timeout`, `Unavailable`, or `RateLimited`, the first
retry uses the jittered exponential schedule.

If any retry succeeds, `program` succeeds with the downstream value. If all
allowed transient retries fail, `Effect.retry` returns the last typed
`DownstreamError`.

## Variants

Use a faster, smaller policy for user-facing paths:

```ts
const interactiveRetry = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2))
)
```

This gives a brief recovery window without hiding the failure from the caller
for long.

Use an elapsed budget when the caller cares more about total waiting time than
attempt count:

```ts
const retryWithinBudget = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("2 seconds"))
)
```

The same `isTransient` predicate can be reused with either schedule. The
predicate answers "is this failure retryable?" The schedule answers "how should
retrying proceed?"

## Notes and caveats

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not made retryable by a schedule.

Prefer the `while` option on `Effect.retry` for error classification. It keeps
the domain predicate at the retry boundary and leaves `Schedule` responsible for
recurrence mechanics: delay, jitter, limits, and observation.

`Schedule.while` is lower level. It receives schedule metadata, including the
input, output, attempt, and selected delay. Use it when a schedule itself must
stop based on schedule metadata. For ordinary error classification before
retrying, `Effect.retry({ while })` is clearer.
