---
book: "Effect `Schedule` Cookbook"
section_number: "22.6"
section_title: "Classify errors before retrying"
part_title: "Part VI — Composition and Termination"
chapter_title: "22. Stop Conditions"
status: "draft"
code_included: true
---

# 22.6 Classify errors before retrying

Retry policies should be narrow. A schedule can say when to try again and when
to stop, but it should not be asked to make every domain decision.

## Problem

A downstream call can fail for several reasons. Some failures are temporary:
timeouts, overload, rate limits, or a service that is briefly unavailable. Other
failures are final for the current request: bad input, authorization failure,
missing configuration, or a business rule violation.

Classify the typed failure first, then let `Effect.retry` apply the schedule
only to genuinely transient failures. Using one broad retry policy for all
errors delays permanent failures, adds load, and hides whether the operation was
never retryable or merely exhausted its retry budget.

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
import { Console, Data, Effect, Schedule } from "effect"

class DownstreamError extends Data.TaggedError("DownstreamError")<{
  readonly reason:
    | "Timeout"
    | "Unavailable"
    | "RateLimited"
    | "BadRequest"
    | "Unauthorized"
}> {}

const classifyStatus = (status: number): DownstreamError => {
  if (status === 408) {
    return new DownstreamError({ reason: "Timeout" })
  }
  if (status === 429) {
    return new DownstreamError({ reason: "RateLimited" })
  }
  if (status >= 500) {
    return new DownstreamError({ reason: "Unavailable" })
  }
  if (status === 401 || status === 403) {
    return new DownstreamError({ reason: "Unauthorized" })
  }
  return new DownstreamError({ reason: "BadRequest" })
}

const statuses = [429, 401] as const
let attempts = 0

const callDownstream = Effect.gen(function*() {
  attempts += 1
  const status = statuses[attempts - 1] ?? 200

  yield* Console.log(`downstream returned ${status}`)

  if (status === 200) {
    return "ok"
  }

  return yield* Effect.fail(classifyStatus(status))
})

const isTransient = (error: DownstreamError) =>
  error.reason === "Timeout" ||
  error.reason === "Unavailable" ||
  error.reason === "RateLimited"

const retryTransientFailures = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const program = callDownstream.pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    while: isTransient
  }),
  Effect.matchEffect({
    onFailure: (error) =>
      Console.log(`stopped on ${error.reason} after ${attempts} attempts`),
    onSuccess: (value) => Console.log(`succeeded with ${value}`)
  })
)

Effect.runPromise(program)
```

The `429` response is classified as transient and retried. The later `401` is
classified as `Unauthorized`, so retrying stops immediately and reports that
typed error.

## Variants

Use a faster, smaller policy for user-facing paths so a permanent failure is not
hidden for long. Use an elapsed budget with `Schedule.during` when the caller
cares more about total waiting time than attempt count.

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
