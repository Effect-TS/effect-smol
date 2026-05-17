---
book: Effect `Schedule` Cookbook
section_number: "19.1"
section_title: "Polling from many clients without synchronization"
part_title: "Part IV — Polling Recipes"
chapter_title: "19. Poll with Jitter"
status: "draft"
code_included: true
---

# 19.1 Polling from many clients without synchronization

Jittered polling keeps a regular status-check cadence while reducing accidental
alignment across callers. The schedule controls timing, while the surrounding
Effect code interprets the observed status.

## Problem

Many clients need to poll the same service for status. A plain fixed polling
interval is simple, but if clients start around the same time, they can keep
checking on the same boundaries.

That synchronization can create unnecessary bursts: every client wakes up,
calls the status endpoint, waits the same amount of time, and then calls it
again together. The service sees waves of traffic instead of a steadier stream.

Add jitter to the polling schedule so each recurrence delay is slightly
different for each client and each decision.

## When to use it

Use this when many independent clients, fibers, workers, or browser sessions
poll the same status endpoint.

It fits polling for work that is already in progress, where each client has its
own identifier and periodically asks whether the remote state has changed.

Use it when a fixed cadence is still the right mental model, but the exact
polling boundary does not need to be identical across callers.

## When not to use it

Do not use jitter as a substitute for a stop condition. It changes recurrence
delays; it does not decide when polling should finish.

Do not use this when the polling cadence must happen on exact wall-clock
boundaries. Jitter intentionally moves each recurrence away from the original
delay.

Do not use client-side jitter as your only protection for a service that needs
strict admission control. Rate limits, quotas, and server-side load shedding
are separate concerns.

## Schedule shape

Start with the normal polling interval, add jitter, preserve the latest status,
and continue only while the status is non-terminal:

```ts
Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending")
)
```

`Schedule.spaced("5 seconds")` supplies the base delay between successful
status checks. `Schedule.jittered` randomly adjusts each recurrence delay
between 80% and 120% of that delay, so a five-second interval becomes a delay
between four seconds and six seconds.

`Schedule.satisfiesInputType<Status>()` makes the timing schedule accept status
values before `Schedule.while` reads `metadata.input`. `Schedule.passthrough`
keeps the latest successful status as the repeat result.

## Code

```ts
import { Effect, Schedule } from "effect"

type Status =
  | { readonly state: "pending"; readonly requestId: string }
  | { readonly state: "complete"; readonly requestId: string; readonly resultId: string }
  | { readonly state: "failed"; readonly requestId: string; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isPending = (status: Status): boolean => status.state === "pending"

declare const checkStatus: (
  requestId: string
) => Effect.Effect<Status, StatusCheckError>

const pollWithJitter = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isPending(input))
)

const pollStatus = (requestId: string) =>
  checkStatus(requestId).pipe(
    Effect.repeat(pollWithJitter)
  )
```

`pollStatus` performs the first status check immediately. If the first
successful status is terminal, the schedule stops without another request. If
the status is `"pending"`, the next check waits for a jittered delay around
five seconds.

Across many clients, each recurrence chooses its own adjusted delay. Even if
clients start together, their later checks are less likely to remain aligned.

## Variants

Add a recurrence cap when the caller should stop after a bounded number of
successful observations:

```ts
const pollWithJitterAtMostThirtyTimes = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isPending(input)),
  Schedule.bothLeft(
    Schedule.recurs(30).pipe(Schedule.satisfiesInputType<Status>())
  )
)
```

This still returns the latest observed `Status`. It may be terminal, or it may
be the last `"pending"` status observed when the recurrence cap stops the
repeat.

Use a shorter base interval for cheap status checks that need quick feedback,
or a longer base interval when the service should receive less polling traffic.
The jitter range follows the base delay: a two-second interval becomes 1.6 to
2.4 seconds, while a thirty-second interval becomes 24 to 36 seconds.

## Notes and caveats

`Schedule.jittered` does not expose configurable jitter bounds. In Effect, it
adjusts each recurrence delay between 80% and 120% of the original delay.

The first status check is not delayed. The schedule controls recurrences after
successful checks.

With `Effect.repeat`, a failure from `checkStatus` stops the repeat unless the
status-check effect has its own retry policy.

`Schedule.while` sees successful status values. It does not classify transport,
decoding, or service errors from the effect error channel.

When combining timing schedules with status predicates, use
`Schedule.satisfiesInputType<T>()` before reading `metadata.input`.
