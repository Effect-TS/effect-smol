---
book: "Effect `Schedule` Cookbook"
section_number: "16.2"
section_title: "Linear backoff"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "16. Choose a Delay Strategy"
status: "draft"
code_included: true
---

# 16.2 Linear backoff

Linear backoff adds the same amount of extra delay at each retry decision. It
reduces pressure gradually while keeping the delay curve easier to explain than
exponential backoff.

Effect does not provide a `Schedule.linear` constructor. Build this policy from
a stateful schedule that counts retry decisions, then derive the delay from
that count.

## Problem

A worker calls an internal dependency that usually recovers within a few
seconds. You want waits such as 250 milliseconds, 500 milliseconds, 750
milliseconds, and 1 second before giving up. Doubling would make later attempts
too far apart for this workflow.

## When to use it

Use linear backoff when each failure should reduce pressure, but you still want
predictable recovery speed. It fits short-lived overload, brief queue or cache
contention, reconnect attempts inside a single process, and internal services
where a simple fixed increment is easier to reason about than an exponential
curve.

## When not to use it

Do not use linear backoff to retry permanent failures. Authentication errors,
validation failures, malformed requests, and unsafe non-idempotent writes should
be handled before the retry policy is applied.

Do not use it as a fleet-wide protection mechanism by itself. If many callers
fail together, a deterministic linear policy can still make them retry together.
For clustered systems or public APIs, consider adding jitter after choosing the
base delay curve.

Do not leave the schedule unbounded unless retrying forever is intentional. A
linear delay grows slowly, so an unbounded policy can keep work alive for a long
time.

## Schedule shape

`Schedule.unfold(initial, next)` outputs the current state and computes the next
state for the following decision. Starting at `1` makes the first retry delay
one increment instead of zero.

`Schedule.addDelay` adds an extra delay based on the schedule output. Because
`Schedule.unfold` has no delay of its own, the added delay becomes the retry
delay.

`Schedule.take(5)` bounds the schedule so the effect can retry only a limited
number of times after the original attempt.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class IndexError extends Data.TaggedError("IndexError")<{
  readonly reason: "busy" | "unavailable"
}> {}

let attempts = 0

const refreshSearchIndex = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`index attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new IndexError({ reason: "busy" }))
  }

  return "index refreshed"
})

const retryWithLinearBackoff = Schedule.unfold(
  1,
  (step) => Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 20))),
  Schedule.take(5)
)

const program = refreshSearchIndex.pipe(
  Effect.retry(retryWithLinearBackoff)
)

Effect.runPromise(program).then((message) => {
  console.log(message)
})
```

The example uses a 20 millisecond increment so it finishes quickly. With a 250
millisecond increment, the same shape would wait 250ms, 500ms, 750ms, and so on.
If all attempts fail, `Effect.retry` returns the last `IndexError`.

## Variants

Use a smaller increment for user-facing paths where responsiveness matters. Use
a larger increment for background work that should reduce downstream pressure
more visibly. If many processes may retry at the same time, add
`Schedule.jittered` to the finished policy.

## Notes and caveats

The step value is schedule state, not the result of the retried effect.
`Effect.retry` feeds typed failures into the schedule, but this policy ignores
the failure value and only uses the retry count.

Because the delay is computed from the step value, changing the initial state
changes the first delay. Start at `0` only when an immediate first retry is
intentional.

Linear backoff has no built-in cap. If the retry count can become large, add a
limit such as `Schedule.take`, a time budget, or a maximum-delay policy before
using it in production.
