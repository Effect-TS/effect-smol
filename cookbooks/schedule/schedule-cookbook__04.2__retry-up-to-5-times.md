---
book: Effect `Schedule` Cookbook
section_number: "4.2"
section_title: "Retry up to 5 times"
part_title: "Part II — Core Retry Recipes"
chapter_title: "4. Retry a Few Times"
status: "draft"
code_included: true
---

# 4.2 Retry up to 5 times

You want to retry an operation a few times before giving up, and five retries is a
reasonable upper bound for the kind of transient failure you expect. This recipe keeps
the retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You want to retry an operation a few times before giving up, and five retries
is a reasonable upper bound for the kind of transient failure you expect. For
example, a remote cache lookup, a short reconnect attempt, or an idempotent
metadata request may be worth trying again briefly before surfacing the error to
the caller.

Use `Schedule.recurs(5)` with `Effect.retry` when the retry budget is exactly
five additional attempts. The first execution is not counted as a retry, so this
policy allows up to six executions total: the original attempt plus five
retries.

## When to use it

Use this recipe when all typed failures should be retried immediately and the
operation is safe to run more than once. It is most appropriate for small,
idempotent effects where an extra few attempts are cheap and the caller benefits
from hiding brief instability.

Five retries is often a practical ceiling for local or low-latency work. It is
large enough to survive a few unlucky races, but still small enough to avoid an
accidental unbounded loop.

## When not to use it

Do not use five immediate retries for dependencies that are already overloaded,
rate-limited, or expensive. In those cases, five can be too many because all
retries happen back-to-back unless you combine the count limit with a delay,
backoff, or jitter policy.

Do not use this policy for non-idempotent writes unless the operation has a
deduplication key, transaction boundary, or another guarantee that repeated
execution will not duplicate external side effects.

Do not use it for defects or interruptions. `Effect.retry` retries typed
failures from the error channel; it does not turn defects or fiber interruptions
into retryable typed errors.

## Schedule shape

`Schedule.recurs(5)` is a count-limited schedule. When `Effect.retry` uses it,
each typed failure is fed into the schedule. If the schedule continues, the
effect runs again. If the schedule stops while the effect is still failing, the
last typed failure is propagated.

The schedule output is the zero-based recurrence count, but plain
`Effect.retry` discards that output when a later attempt succeeds. For this
recipe, the important shape is the retry budget:

- attempt 1: original execution
- attempts 2 through 6: at most five retries
- if attempt 6 fails, the final failure is returned

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class LookupError extends Data.TaggedError("LookupError")<{
  readonly key: string
}> {}

interface Profile {
  readonly id: string
  readonly displayName: string
}

declare const loadProfile: (id: string) => Effect.Effect<Profile, LookupError>

const retryUpTo5Times = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.retry(Schedule.recurs(5)))

const program = retryUpTo5Times(loadProfile("user-123"))
```

`program` runs `loadProfile("user-123")` once, then retries it up to five more
times if it fails with a typed `LookupError`. A success on any attempt completes
the whole effect with the `Profile`. If every attempt fails, the last
`LookupError` is propagated.

## Variants

For a one-off local policy, the options form is equivalent and a little shorter:

```ts
const program = loadProfile("user-123").pipe(
  Effect.retry({ times: 5 })
)
```

Use the schedule form when you want a named policy that can be composed later:

```ts
const retryUpTo5WithBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = loadProfile("user-123").pipe(
  Effect.retry(retryUpTo5WithBackoff)
)
```

This keeps the same count limit, but spaces attempts with exponential backoff.
That is usually a better production shape for network calls than five immediate
retries.

## Notes and caveats

`Schedule.recurs(5)` means five retries, not five total attempts. If an API or
product requirement says "try five times total", use `Schedule.recurs(4)`.

Five retries is too many when each attempt is slow, costly, externally visible,
or likely to increase pressure on an unhealthy dependency. In those cases,
reduce the count, add a delay policy, filter retryable errors with `while` or
`until`, or fail fast and let a higher-level workflow decide what to do.

Keep the retry boundary small. Put `Effect.retry` around the operation that may
transiently fail, not around a larger workflow that also performs logging,
notifications, writes, or other effects that should not be repeated.
