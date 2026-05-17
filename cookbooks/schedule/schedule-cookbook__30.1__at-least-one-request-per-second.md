---
book: Effect `Schedule` Cookbook
section_number: "30.1"
section_title: "At least one request per second"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "30. Space Requests Intentionally"
status: "draft"
code_included: true
---

# 30.1 At least one request per second

Use `Schedule` to make a repeat loop's pacing visible instead of hiding sleeps
around request code.

This recipe uses `Schedule.spaced("1 second")` when each request should be
followed by a one-second pause before the next request starts. Use
`Schedule.fixed("1 second")` instead when the loop should target fixed
wall-clock boundaries.

## Problem

A client or worker may need to keep making requests without running in a tight
loop. Reviewers should be able to see whether the one-second rule is a
post-completion gap or a fixed interval boundary, because those shapes behave
differently when requests are slow.

## When to use it

Use this when a single fiber should keep sending requests with a controlled gap
between them. It fits background synchronization, lightweight polling,
heartbeat-style calls, and integrations where a steady request stream is useful
but bursts are not.

It is especially useful when request duration should contribute to the overall
spacing. If a request takes 300 milliseconds and the schedule is spaced by one
second, the next request starts about one second after the previous request
completed, not 700 milliseconds later.

## When not to use it

Do not use this wording when you really mean a minimum throughput guarantee.
`Schedule.spaced("1 second")` can prevent a loop from running more frequently
than one request plus one gap, but it cannot ensure at least one completed
request per second when requests are slow, blocked, retried elsewhere, or
interrupted.

Do not use this as a fleet-wide rate limiter. A schedule controls one repeated
effect. Coordinating many fibers, processes, or hosts needs a shared limiter,
queue, semaphore, or service-side quota policy.

Do not use `Effect.repeat` to retry failed requests. With `Effect.repeat`, a
typed failure from the request stops the repeat. If failures should be retried,
apply a retry policy around the request itself and then repeat the successful
request loop.

## Schedule shape

The basic policy is:

```ts
Schedule.spaced("1 second")
```

`Schedule.spaced("1 second")` recurs continuously and contributes a one-second
delay to every recurrence decision. With `Effect.repeat`, the first request
runs immediately. After each successful request, the schedule waits one second
before the next request starts.

The shape is:

- request 1: run immediately
- if request 1 succeeds: wait one second
- request 2: run again
- if request 2 succeeds: wait one second
- continue until the fiber is interrupted, the request fails, or a bounded
  variant stops the schedule

Use `Schedule.fixed("1 second")` for a different shape: it targets fixed
one-second interval boundaries. If a request takes longer than the interval,
the next run happens immediately, but missed runs do not pile up.

## Code

```ts
import { Effect, Schedule } from "effect"

type RequestError = {
  readonly _tag: "RequestError"
  readonly message: string
}

declare const sendRequest: Effect.Effect<void, RequestError>

const oneSecondAfterEachRequest = Schedule.spaced("1 second")

const program = sendRequest.pipe(
  Effect.repeat(oneSecondAfterEachRequest)
)
```

`program` sends the first request immediately. If that request succeeds, it
waits one second and sends the next request. If any request fails with
`RequestError`, the repeat stops with that failure.

The schedule output is the recurrence count, but this program does not use it.
The operational contract is the delay between successful request runs.

## Variants

Bound the loop when the worker should perform only a limited number of
additional requests:

```ts
const fiveMoreRequestsOneSecondApart = Schedule.spaced("1 second").pipe(
  Schedule.take(5)
)

const boundedProgram = sendRequest.pipe(
  Effect.repeat(fiveMoreRequestsOneSecondApart)
)
```

The first request still runs immediately. `Schedule.take(5)` limits the
recurrences after that first request, so this program can run at most six
successful requests total.

Use `Schedule.fixed("1 second")` when fixed interval boundaries are the
requirement:

```ts
const oneSecondBoundaries = Schedule.fixed("1 second")

const fixedCadenceProgram = sendRequest.pipe(
  Effect.repeat(oneSecondBoundaries)
)
```

This is useful for checks that should stay aligned to a cadence. It is not the
same as "sleep one second after each request"; if a request runs long, the next
request may start immediately.

## Notes and caveats

Be careful with the phrase "at least one request per second". In ordinary rate
limiting language, this recipe is closer to "no more often than one request
plus one one-second gap per loop". It spaces requests; it does not guarantee a
minimum successful request rate.

`Schedule.spaced("1 second")` delays recurrences; it does not delay the first
request. The first execution of the repeated effect happens immediately.

`Schedule.fixed("1 second")` and `Schedule.spaced("1 second")` are both real
cadence APIs, but they answer different questions. Use `spaced` for a gap after
work completes. Use `fixed` for fixed interval boundaries.

`Effect.repeat` feeds successful values into the schedule. Failed requests do
not become schedule inputs; they stop the repeat unless you handle or retry
them before repeating.
