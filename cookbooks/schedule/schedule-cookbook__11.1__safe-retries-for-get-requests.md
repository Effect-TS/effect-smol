---
book: Effect `Schedule` Cookbook
section_number: "11.1"
section_title: "Safe retries for GET requests"
part_title: "Part II — Core Retry Recipes"
chapter_title: "11. Idempotency and Retry Safety"
status: "draft"
code_included: true
---

# 11.1 Safe retries for GET requests

GET requests are usually safe to retry because they are intended to read state rather
than change it. This recipe keeps read retries bounded, typed, and explicit.

## Problem

The risk is not usually duplicate mutation. The risk is turning a harmless read
into unbounded pressure on the downstream service, hiding persistent failures,
or making a cache fill wait much longer than its caller can tolerate.

Use a finite `Schedule` and keep the retry boundary around the single read. The
schedule controls delay and budget. A predicate on the typed failure decides
which failures are transient enough to try again.

## When to use it

Use this recipe for read-only HTTP calls such as fetching a resource, checking a
status endpoint, looking up metadata, refreshing a view model, or filling a
cache from a remote source.

It is also useful when the value is replaceable: if the first attempt fails and
a later attempt succeeds, the caller only observes the final read result. This
fits cache misses, polling-style status checks, and service-to-service GETs that
do not perform a visible action on the server.

Keep the policy bounded even for safe reads. A GET can still consume connection
slots, server CPU, database capacity, and caller latency budget.

## When not to use it

Do not use this section as a complete policy for writes, even if the endpoint is
named like a read. Duplicate-safe writes, idempotency keys, and mutation retry
safety belong in sibling sections.

Do not retry every GET failure. A malformed URL, authorization failure, missing
resource, or decode error is unlikely to improve by waiting.

Do not wrap a large workflow in a retry only because one step is a GET. Retry
the read itself, before local state changes, notifications, or other effects are
performed.

## Schedule shape

For GET requests, the usual shape is:

- a small initial delay, often exponential backoff
- jitter, so many callers do not retry at the same instant
- a finite retry count, time budget, or both
- an error predicate that allows only transient failures

`Schedule.exponential("100 millis")` provides the backoff delays.
`Schedule.jittered` randomly adjusts each delay between 80% and 120% of the
original delay. `Schedule.both(Schedule.recurs(3))` keeps the policy finite:
both schedules must continue, so the read is retried at most three times after
the original attempt.

With `Effect.retry`, the GET runs once immediately. Only failures from the typed
error channel are retried, and only while the predicate returns `true`.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class GetUserError extends Data.TaggedError("GetUserError")<{
  readonly reason: "Timeout" | "ConnectionReset" | "BadGateway" | "NotFound" | "Unauthorized" | "DecodeError"
}> {}

interface User {
  readonly id: string
  readonly name: string
}

declare const getUser: (id: string) => Effect.Effect<User, GetUserError>

const isRetryableGetFailure = (error: GetUserError): boolean => {
  switch (error.reason) {
    case "Timeout":
    case "ConnectionReset":
    case "BadGateway":
      return true
    case "NotFound":
    case "Unauthorized":
    case "DecodeError":
      return false
  }
}

const safeGetRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const program = getUser("user-123").pipe(
  Effect.retry({
    schedule: safeGetRetryPolicy,
    while: isRetryableGetFailure
  })
)
```

`program` performs the GET once. If the call fails with a timeout, connection
reset, or bad gateway error, it retries with jittered exponential backoff for at
most three retries. If it fails with a non-retryable read error, retrying stops
immediately and that typed failure is returned.

The same shape works for cache fills. Keep the cache write outside the retried
GET if the cache layer writes only after a successful read. That way each retry
is still just another attempt to obtain the same value.

## Variants

For status lookups that are cheap and user-facing, use fewer retries and a
smaller delay. For background cache refreshes, use a slower base delay and a
slightly larger budget. The reads are still safe, but the downstream service may
already be under pressure:

```ts
const statusLookupRetryPolicy = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2))
)

const cacheRefreshRetryPolicy = Schedule.exponential("250 millis", 1.5).pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)
```

The status policy gives the caller a quick second and third chance without
letting a status badge or refresh button wait behind a long retry sequence.

For observability, attach logging or metrics around the retried GET rather than
changing the schedule into an unbounded one. Count attempts, final failures, and
latency separately so a safe retry policy remains visible in production.

## Notes and caveats

Safe does not mean free. Retried GET requests can amplify traffic during an
incident, especially when many callers share the same policy.

The first GET is not delayed. The schedule is consulted only after the effect
fails with a typed error.

`Schedule.exponential` does not stop by itself. Pair it with `Schedule.recurs`,
`times`, a time budget, or another stopping condition.

`Schedule.recurs(3)` means three retries after the original attempt, not three
total attempts.

Jitter is usually appropriate for service calls and cache fills. It is less
important for a single local caller, but it becomes valuable as soon as many
fibers, processes, or hosts can fail at the same time.

Keep retry predicates explicit. A GET that returns `404 Not Found` for a real
missing resource should normally fail fast, while a timeout or gateway failure
may be worth another attempt.
