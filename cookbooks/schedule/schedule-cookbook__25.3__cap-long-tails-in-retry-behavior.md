---
book: Effect `Schedule` Cookbook
section_number: "25.3"
section_title: "Cap long tails in retry behavior"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.3 Cap long tails in retry behavior

Use this to keep late retries visible by putting a maximum wait on a growing
backoff policy.

## Problem

Long retry tails make systems look idle while work is still pending. A worker
may be holding a queue lease, a supervisor may be waiting for reconnect, or an
operator may be looking for the next attempt in logs. A cap keeps the tail
within a known interval.

## When to use it

Use it for idempotent retry paths such as control-plane calls, reconnect loops,
queue consumers, and reconciliation jobs. The cap answers "how long until this
tries again?" and a separate retry limit answers "when does this stop?"

## When not to use it

Do not use a cap to make permanent failures look transient. Classify validation
errors, authorization failures, malformed requests, and unsafe writes before the
retry policy is applied.

Do not treat the cap as a total timeout. A 5-second cap only bounds the delay
between attempts. The total runtime also depends on how many retries are allowed
and how long each attempted operation takes.

## Schedule shape

Start with `Schedule.exponential(base)`, then clamp the actual delay selected
for the next recurrence with `Schedule.modifyDelay`. The clamp is
`Duration.min(delay, Duration.seconds(5))`.

`Schedule.exponential` still outputs the uncapped exponential duration.
`Schedule.modifyDelay` changes the actual sleep used by the schedule. Add
stopping behavior separately with `Schedule.recurs` or `Schedule.during`.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class ControlPlaneUnavailable extends Data.TaggedError(
  "ControlPlaneUnavailable"
)<{
  readonly service: string
  readonly attempt: number
}> {}

let attempts = 0

const refreshRoutingTable = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`refresh attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(
      new ControlPlaneUnavailable({
        service: "routing",
        attempt: attempts
      })
    )
  }

  return "routes refreshed"
})

const capAt5Seconds = (delay: Duration.Duration) =>
  Duration.min(delay, Duration.seconds(5))

const cappedBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) => Effect.succeed(capAt5Seconds(delay))),
  Schedule.tapInput((error: ControlPlaneUnavailable) =>
    Console.log(`retrying ${error.service} after attempt ${error.attempt}`)
  ),
  Schedule.tapOutput((rawDelay) =>
    Console.log(
      `raw next delay: ${Duration.format(rawDelay)}, capped at: ${
        Duration.format(capAt5Seconds(rawDelay))
      }`
    )
  ),
  Schedule.both(Schedule.recurs(8))
)

const program = refreshRoutingTable.pipe(
  Effect.retry(cappedBackoff),
  Effect.flatMap((message) => Console.log(`result: ${message}`))
)

Effect.runPromise(program)
```

`Schedule.tapInput` logs the failure that caused a retry. `Schedule.tapOutput`
logs the raw exponential output and the capped value used by the delay
calculation.

## Variants

Use a smaller cap for interactive work. Add `Schedule.during` when the whole
retry window needs an elapsed budget. For fleet-wide retry paths, apply
`Schedule.jittered` before the final cap so randomization does not break the
maximum-delay guarantee.

## Notes and caveats

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts.

Capping long tails is an operational visibility tool, not just a latency tweak:
dashboards, logs, alerts, and humans can reason about the next retry without
reading scattered sleeps or hidden counters.
