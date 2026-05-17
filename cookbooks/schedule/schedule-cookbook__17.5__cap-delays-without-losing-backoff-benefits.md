---
book: "Effect `Schedule` Cookbook"
section_number: "17.5"
section_title: "Cap delays without losing backoff benefits"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "17. Operational Backoff Recipes"
status: "draft"
code_included: true
---

# 17.5 Cap delays without losing backoff benefits

Use this to keep the useful early shape of exponential backoff while preventing
late delays from becoming too long.

## Problem

Backoff should reduce pressure quickly: `250 millis`, `500 millis`, `1 second`,
`2 seconds`, and so on. The same curve can later drift into 16, 32, or 64 second
waits. The policy should say both things: grow while the delay is small, then
stop growing at the cap.

## When to use it

Use it for retry or reconnect loops where short early retries are helpful but
long tail delays are not: control-plane calls, startup probes, worker reconnects,
and idempotent remote operations. It is also useful when the maximum single
delay is part of the operational contract.

## When not to use it

Do not use capped backoff to make permanent failures look transient. Classify
validation errors, authorization failures, malformed requests, and unsafe
non-idempotent writes before `Effect.retry` applies the schedule.

Avoid it when a fixed cadence is the real requirement. If every retry should
wait exactly 5 seconds, use `Schedule.spaced("5 seconds")`.

## Schedule shape

Build the policy in two steps:

- start with `Schedule.exponential`, which outputs the computed delay and uses
  that delay before the next recurrence
- apply `Schedule.modifyDelay` with `Duration.min` so the delay used by the
  schedule is never larger than the cap

The cap does not flatten the whole policy. With a base of `250 millis` and a
5-second cap, the early delays are still `250 millis`, `500 millis`, `1 second`,
`2 seconds`, and `4 seconds`. Only computed delays above 5 seconds are replaced.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class RemoteError extends Data.TaggedError("RemoteError")<{
  readonly attempt: number
}> {}

let attempts = 0

const callControlPlane = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new RemoteError({ attempt: attempts }))
  }

  return "ok"
})

const capAt5Seconds = (delay: Duration.Duration) =>
  Duration.min(delay, Duration.seconds(5))

const cappedCadence = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) => Effect.succeed(capAt5Seconds(delay))),
  Schedule.tapOutput((rawDelay) =>
    Console.log(
      `raw delay ${Duration.format(rawDelay)} -> capped ${
        Duration.format(capAt5Seconds(rawDelay))
      }`
    )
  )
)

const retryPolicy = cappedCadence.pipe(
  Schedule.both(Schedule.recurs(8))
)

const program = callControlPlane.pipe(
  Effect.retry(retryPolicy),
  Effect.flatMap((result) => Console.log(`result: ${result}`))
)

Effect.runPromise(program)
```

Delays below the cap pass through unchanged, so the policy keeps the early
benefit of exponential spacing. Delays above the cap are limited, so the late
retry loop cannot become quieter than the workflow allows.

## Variants

For a gentler curve, pass a smaller factor to `Schedule.exponential`, such as
`Schedule.exponential("250 millis", 1.5)`. The same cap still applies; it just
takes more recurrences to reach it.

For many instances using the same retry policy, apply `Schedule.jittered` before
the final cap. That spreads retry traffic while preserving the maximum-delay
promise.

## Notes and caveats

`Schedule.modifyDelay` changes the delay used between recurrences; it does not
change the schedule output. In the example, `Schedule.tapOutput` receives the
raw exponential delay and computes the capped value separately for logging.

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. That distinction matters if you later add
predicates or observation hooks such as `Schedule.tapInput`.
