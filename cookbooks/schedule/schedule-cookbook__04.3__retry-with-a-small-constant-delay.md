---
book: Effect `Schedule` Cookbook
section_number: "4.3"
section_title: "Retry with a small constant delay"
part_title: "Part II — Core Retry Recipes"
chapter_title: "4. Retry a Few Times"
status: "draft"
code_included: true
---

# 4.3 Retry with a small constant delay

You have a failing effect that is worth retrying a few times, but immediate retries are
too aggressive. A short, fixed pause between attempts gives the dependency a little time
to recover without making the policy more complicated than it needs to be. This recipe
keeps the retry policy explicit: the schedule decides when another typed failure should
be attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You have a failing effect that is worth retrying a few times, but immediate
retries are too aggressive. A short, fixed pause between attempts gives the
dependency a little time to recover without making the policy more complicated
than it needs to be.

Use `Schedule.spaced(duration)` for the delay and combine it with
`Schedule.recurs(n)` for the retry limit:

```ts
const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)
```

This means "wait 100 milliseconds before each retry, and retry at most three
times after the initial attempt."

## When to use it

Use this recipe for small transient failures where an immediate retry may be too
soon, but a full backoff policy is unnecessary. It fits short-lived connection
hiccups, local service restarts, brief lock contention, and idempotent requests
to dependencies that usually recover quickly.

It is also a good step up from `Schedule.recurs(n)` when you discover that
immediate retries are noisy in logs or put unnecessary pressure on a dependency.
The count is still explicit, and the delay is easy to read.

## When not to use it

Do not use a constant delay when failures are likely to be caused by overload or
rate limiting. Those cases usually need a policy that spreads demand out more
carefully.

Do not use it without a retry limit unless unbounded retry is intentional.
`Schedule.spaced("100 millis")` by itself keeps recurring forever, so pair it
with `Schedule.recurs`, `times`, a predicate, or another stopping condition.

Do not use it for operations that are not safe to run more than once. Retrying a
write needs idempotency, deduplication, or a domain-specific recovery strategy.

## Schedule shape

`Schedule.spaced(duration)` is an unbounded schedule that produces the same
delay on every recurrence. The schedule tests verify this constant-delay shape:
stepping a spaced schedule repeatedly yields the same duration each time.

`Schedule.recurs(times)` is the finite part of the policy. In a retry, it counts
retry decisions after the first execution. `Schedule.recurs(3)` allows up to
three retries, for up to four executions total.

`Schedule.both(left, right)` combines two schedules with intersection semantics.
Both schedules must want to continue, and the combined schedule uses the maximum
of the two delays. Since `Schedule.recurs(3)` has no extra delay and
`Schedule.spaced("100 millis")` delays each recurrence by 100 milliseconds, the
combined policy retries at most three times with a 100 millisecond delay before
each retry.

The combined schedule outputs a tuple of the two schedule outputs. `Effect.retry`
uses the schedule to decide whether and when to retry, but it succeeds with the
successful value of the retried effect, not with that tuple.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class TemporaryRequestError extends Data.TaggedError("TemporaryRequestError")<{
  readonly attempt: number
}> {}

let attempt = 0

const request = Effect.gen(function*() {
  attempt += 1

  if (attempt < 4) {
    return yield* Effect.fail(new TemporaryRequestError({ attempt }))
  }

  return { id: "user-1", name: "Ada" }
})

const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = request.pipe(
  Effect.retry(retryPolicy)
)
```

Here `request` fails on attempts 1, 2, and 3, then succeeds on attempt 4. The
policy waits 100 milliseconds before each retry and permits exactly three
retries, so `program` succeeds with the user value.

If attempt 4 failed too, `Schedule.recurs(3)` would be exhausted and
`Effect.retry` would propagate the last `TemporaryRequestError`.

## Variants

You can write the same policy with retry options:

```ts
const program = request.pipe(
  Effect.retry({
    schedule: Schedule.spaced("100 millis"),
    times: 3
  })
)
```

This is compact when the policy is local to one call site. Use the explicit
`Schedule.spaced(...).pipe(Schedule.both(Schedule.recurs(...)))` form when you
want to name the policy, reuse it, or compose it further.

You can also pass the effect as the first argument:

```ts
const program = Effect.retry(request, retryPolicy)
```

This is equivalent to the piped form.

For a slightly slower retry loop, change only the duration:

```ts
const retryPolicy = Schedule.spaced("500 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)
```

The retry count and the shape of the policy stay the same.

## Notes and caveats

The first execution is not delayed. The delay happens between a typed failure
and the next retry attempt.

`Effect.retry` retries typed failures from the error channel. Defects and
interruptions are not retried as typed failures.

The delay is constant, not adaptive. If a dependency is overloaded, a constant
delay can still keep pressure high. Treat this as a small retry recipe for
simple transient failures, not as a general production policy for every remote
call.

Keep the retried effect as small as possible. Retry the operation that can
safely be attempted again, not a larger workflow that may already have completed
other side effects before the failure occurred.
