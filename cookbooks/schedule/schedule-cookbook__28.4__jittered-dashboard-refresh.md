---
book: Effect `Schedule` Cookbook
section_number: "28.4"
section_title: "Jittered dashboard refresh"
part_title: "Part VI — Jitter Recipes"
chapter_title: "28. Jitter for Repeat and Polling"
status: "draft"
code_included: true
---

# 28.4 Jittered dashboard refresh

Dashboard refresh is successful polling, not retry. Use jitter when many open
sessions can poll the same endpoint on the same cadence.

## Problem

A dashboard should fetch an initial snapshot immediately and keep refreshing
while it remains open. If many sessions open, deploy, or reconnect together,
later polls should drift around the human-facing interval instead of lining up
exactly every ten seconds.

## When to use it

Use this when many independent dashboard sessions poll the same endpoint and
exact wall-clock alignment is not part of the product behavior.

It fits operational dashboards, analytics summaries, admin consoles, and
wallboards where "roughly every ten seconds" is acceptable and avoiding
synchronized polling is more important than refreshing on an exact tick.

## When not to use it

Do not use jitter when the refresh must happen on exact wall-clock boundaries,
such as a clock display, metronomic protocol heartbeat, or externally specified
reporting window.

Do not use client-side jitter as the only protection for an overloaded backend.
It reduces accidental coordination, but rate limits, caching, admission control,
and server-side load shedding are separate tools.

Avoid polling when a streaming subscription, WebSocket, server-sent event, or
push notification gives a cleaner dashboard update model.

## Schedule shape

Start with the dashboard refresh cadence, then apply `Schedule.jittered`.
`Schedule.spaced("10 seconds")` supplies the base delay after each successful
refresh. Jitter adjusts each recurrence delay between 80% and 120% of that
delay, so a ten-second interval becomes a delay between eight and twelve
seconds.

The first refresh is still performed immediately by `Effect.repeat`; the schedule
controls only the follow-up refreshes.

## Code

```ts
import { Effect, Schedule } from "effect"

type DashboardSnapshot = {
  readonly activeUsers: number
  readonly openIncidents: number
  readonly open: boolean
}

let poll = 0

const fetchDashboardSnapshot = Effect.sync((): DashboardSnapshot => {
  poll += 1
  const snapshot = {
    activeUsers: 40 + poll,
    openIncidents: Math.max(0, 3 - poll),
    open: poll < 4
  }
  console.log(
    `dashboard poll ${poll}: users=${snapshot.activeUsers}, open=${snapshot.open}`
  )
  return snapshot
})

const demoRefreshSchedule = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.take(10)
)

const program = fetchDashboardSnapshot.pipe(
  Effect.repeat({
    schedule: demoRefreshSchedule,
    while: (snapshot) => snapshot.open
  }),
  Effect.tap((snapshot) =>
    Effect.sync(() =>
      console.log(`dashboard stopped with ${snapshot.openIncidents} incidents`)
    )
  )
)

Effect.runPromise(program)
```

The `open` field is only a short demo stand-in for dashboard lifecycle state.
In a real UI, the fiber would usually be interrupted when the dashboard closes.

## Variants

Use a shorter base cadence when freshness matters and the endpoint is cheap. Use
a longer cadence when the dashboard aggregates expensive data or serves many
concurrent viewers. The jitter range follows the base cadence.

If the dashboard should stop after a fixed observation budget, combine the
jittered polling policy with `Schedule.recurs`, `Schedule.take`, or a repeat
`while` predicate tied to dashboard lifecycle state.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It randomly adjusts each recurrence
delay between 80% and 120% of the delay produced by the wrapped schedule.

With `Effect.repeat`, successful dashboard snapshots are fed into the schedule.
A failure from `fetchDashboardSnapshot` stops the repeat unless the fetch effect
has its own retry policy.

Jitter changes timing only. It does not cache responses, limit concurrency,
classify errors, or decide whether the dashboard is still useful to the user.
Keep those concerns explicit around the refresh effect.
