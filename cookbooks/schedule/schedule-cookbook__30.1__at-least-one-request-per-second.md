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

The basic policy is `Schedule.spaced("1 second")`. It recurs continuously and
contributes a one-second delay to every recurrence decision. With
`Effect.repeat`, the first request runs immediately. After each successful
request, the schedule waits one second before the next request starts.

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
import { Console, Effect, Ref, Schedule } from "effect"

type RequestError = {
  readonly _tag: "RequestError"
  readonly message: string
}

const oneSecondAfterEachRequest = Schedule.spaced("1 second").pipe(
  Schedule.take(2)
)

const program = Effect.gen(function*() {
  const sent = yield* Ref.make(0)

  const sendRequest: Effect.Effect<void, RequestError> = Ref.updateAndGet(
    sent,
    (n) => n + 1
  ).pipe(
    Effect.tap((requestNumber) =>
      Console.log(`sent request ${requestNumber}`)
    ),
    Effect.flatMap(() => Effect.sleep("25 millis"))
  )

  const finalRecurrence = yield* sendRequest.pipe(
    Effect.repeat(oneSecondAfterEachRequest)
  )

  yield* Console.log(`schedule stopped after recurrence ${finalRecurrence}`)
})

Effect.runPromise(program)
```

`program` sends the first request immediately, then waits one second after each
successful request before the next run. `Schedule.take(2)` keeps the example
finite: one initial run plus two scheduled recurrences.

The schedule output is the recurrence count. The operational contract is the
delay between successful request runs.

## Variants

Bound the loop when the worker should perform only a limited number of
additional requests. The first request still runs immediately; `Schedule.take(5)`
limits the scheduled recurrences after that first request.

Use `Schedule.fixed("1 second")` when fixed interval boundaries are the
requirement. It is not the same as "sleep one second after each request"; if a
request runs long, the next request may start immediately.

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
