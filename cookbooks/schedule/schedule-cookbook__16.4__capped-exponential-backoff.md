---
book: "Effect `Schedule` Cookbook"
section_number: "16.4"
section_title: "Capped exponential backoff"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "16. Choose a Delay Strategy"
status: "draft"
code_included: true
---

# 16.4 Capped exponential backoff

Capped exponential backoff grows retry delays quickly at first, then stops
increasing once they reach an operational maximum. The cap keeps a caller,
worker, or supervisor from waiting minutes or hours between attempts.

## Problem

An operation can tolerate short exponential delays at the start of an outage,
but not the long tail of an uncapped curve. A request timeout, queue lease,
reconnect loop, or operational alert window may require every retry decision to
stay below a known maximum.

## When to use it

Use capped exponential backoff when the first few retries should spread out
quickly, but every later retry still needs to happen within a known maximum
interval.

This is a common fit for idempotent calls to HTTP APIs, databases, queues,
caches, and control planes. The cap gives operators a concrete answer to "how
long can this wait between attempts?" while preserving the load-shedding
benefit of exponential growth.

## When not to use it

Do not use this policy to make unsafe work retryable. Non-idempotent writes need
idempotency keys, deduplication, transactions, or another domain guarantee
before retrying is safe.

Do not treat the cap as a total timeout. A policy capped at 5 seconds can still
spend much longer overall if it allows many retries. Use a retry limit or a
time budget when the whole operation must finish within a bound.

Do not use the same capped curve across a large fleet without thinking about
synchronization. If many clients fail together, add jitter after the base timing
is correct.

## Schedule shape

Start with `Schedule.exponential(base)`. It returns a schedule whose output is
the current delay and whose delay grows by the exponential factor.

Use `Schedule.modifyDelay` to clamp each computed delay before it is used. Add
a retry limit separately with `Schedule.both(Schedule.recurs(n))` when the
operation should eventually give up.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
}> {}

let attempts = 0

const refreshControlPlaneState = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`control-plane attempt ${attempts}`)

  if (attempts < 5) {
    return yield* Effect.fail(
      new ServiceUnavailable({ service: "control-plane" })
    )
  }

  return "control plane refreshed"
})

const cappedBackoff = Schedule.exponential("20 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(50)))
  ),
  Schedule.both(Schedule.recurs(8))
)

const program = refreshControlPlaneState.pipe(
  Effect.retry(cappedBackoff)
)

Effect.runPromise(program).then((message) => {
  console.log(message)
})
```

The first call to `refreshControlPlaneState` runs immediately. If it fails with
`ServiceUnavailable`, retries use exponential delays starting at 20
milliseconds. Each delay is capped at 50 milliseconds in the example. A
production policy might use a 5 second or 30 second cap, depending on the
workflow.

## Variants

Use a smaller cap for interactive work and a larger cap for background recovery.
If many processes may retry the same dependency together, keep the cap and add
`Schedule.jittered`.

## Notes and caveats

`Schedule.modifyDelay` changes the delay chosen by the schedule. It does not
change the schedule output. For `Schedule.exponential`, the output remains the
uncapped exponential duration, even though the actual wait has been capped.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts.

With `Effect.retry`, failures are fed into the schedule. If the schedule stops,
the last typed failure is returned. If any attempt succeeds, the retry policy is
finished and the successful value is returned.
