---
book: "Effect `Schedule` Cookbook"
section_number: "15.5"
section_title: "Polling from many clients without synchronization"
part_title: "Part IV — Polling Recipes"
chapter_title: "15. Adaptive and Fleet-Safe Polling"
status: "draft"
code_included: true
---

# 15.5 Polling from many clients without synchronization

Use jitter when many clients poll the same service on a regular cadence, but no
client needs to land on an exact shared boundary. Jitter keeps the interval
recognizable while making each recurrence delay vary slightly.

## Problem

If many clients start together and all poll every five seconds, they can keep
calling the status endpoint in waves. The average request rate may be fine, but
the service sees short synchronized bursts instead of a steadier stream.

Jitter is a small random adjustment to each recurrence delay. It does not change
what status means or when polling should stop; it only reduces accidental timing
alignment.

## When to use it

Use this for independent clients, fibers, workers, or browser sessions that poll
the same read-only status endpoint.

It fits work that is already in progress, where each caller has its own id and
periodically asks whether the remote state has changed.

## When not to use it

Do not use jitter as a stop condition. Polling still needs a status predicate,
timeout, recurrence cap, or external interruption.

Do not use it for clock-aligned work, such as checks that must run exactly at
the top of each minute.

Do not treat client-side jitter as overload control. Rate limits, admission
control, quotas, and server-side load shedding are separate mechanisms.

## Schedule shape

Start with `Schedule.spaced` for the base interval, apply
`Schedule.jittered`, preserve the latest status with `Schedule.passthrough`,
and stop with `Schedule.while` once the status is no longer pending.

In Effect, `Schedule.jittered` adjusts each delay to between 80% and 120% of
the original delay. A five-second interval becomes a recurrence delay between
four and six seconds.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type Status =
  | { readonly state: "pending"; readonly requestId: string }
  | { readonly state: "complete"; readonly requestId: string; readonly resultId: string }

const scriptedStatuses: ReadonlyArray<Status> = [
  { state: "pending", requestId: "request-42" },
  { state: "pending", requestId: "request-42" },
  { state: "complete", requestId: "request-42", resultId: "result-7" }
]

let readIndex = 0

const checkStatus = (requestId: string): Effect.Effect<Status> =>
  Effect.sync(() => {
    const status = scriptedStatuses[
      Math.min(readIndex, scriptedStatuses.length - 1)
    ]!
    readIndex += 1
    return status
  }).pipe(
    Effect.tap((status) =>
      Console.log(`[${requestId}] observed ${status.state}`)
    )
  )

const pollWithJitter = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending")
)

const program = checkStatus("request-42").pipe(
  Effect.repeat(pollWithJitter),
  Effect.tap((status) => Console.log(`finished with ${status.state}`))
)

Effect.runPromise(program).then((status) => {
  console.log("result:", status)
})
```

The first status check runs immediately. Later checks wait for the jittered
delay, and the repeat stops as soon as the latest successful status is no longer
`"pending"`.

## Variants

Add `Schedule.take` or combine with `Schedule.recurs` when the caller needs a
hard recurrence limit. Interpret the last status explicitly, because a bounded
schedule can stop while the operation is still pending.

Use a shorter base interval for cheap status checks that need quick feedback.
Use a longer interval when the dependency should receive less polling traffic.

If the status request itself can fail transiently, retry that request separately
before repeating it. `Effect.repeat` feeds successful status values into the
schedule; failures stop the repeat unless handled first.

## Notes and caveats

`Schedule.jittered` has fixed bounds: 80% to 120% of the original delay.

`Schedule.while` sees successful status values only. It does not classify
transport, decoding, authorization, or service failures from the effect error
channel.

When a timing schedule reads the latest status through `metadata.input`, apply
`Schedule.satisfiesInputType<T>()` before `Schedule.while`.
