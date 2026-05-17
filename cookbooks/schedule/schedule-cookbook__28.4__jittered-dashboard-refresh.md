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

Dashboard refresh is polling-driven successful work, not a retry. This recipe adds
jitter to a fixed refresh cadence for clients that do not need exact wall-clock
alignment.

## Problem

A dashboard should fetch an initial snapshot immediately and keep refreshing while it
remains open. If many sessions open, deploy, or reconnect together, later polls should
drift around the human-facing refresh interval instead of lining up exactly every ten
seconds.

## When to use it

Use this when many independent dashboard sessions poll the same endpoint and exact
wall-clock alignment is not part of the product behavior.

It fits operational dashboards, analytics summaries, admin consoles, and wallboards
where "roughly every ten seconds" is acceptable and avoiding synchronized polling is
more important than refreshing on an exact tick.

## When not to use it

Do not use jitter when the refresh must happen on exact wall-clock boundaries, such as a
clock display, metronomic protocol heartbeat, or externally specified reporting window.

Do not use client-side jitter as the only protection for an overloaded backend. It
reduces accidental coordination, but rate limits, caching, admission control, and
server-side load shedding are separate tools.

Also avoid polling when a streaming subscription, WebSocket, server-sent event, or push
notification gives a cleaner dashboard update model.

## Schedule shape

Start with the dashboard refresh cadence, jitter each recurrence delay, preserve the
latest successful snapshot, and stop when the dashboard is no longer active:

```ts
Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DashboardSnapshot>(),
  Schedule.passthrough,
  Schedule.while(() => isDashboardOpen())
)
```

`Schedule.spaced("10 seconds")` supplies the base delay after each successful refresh.
`Schedule.jittered` adjusts each recurrence delay between 80% and 120% of that delay, so
a ten-second interval becomes a delay between eight and twelve seconds.

The first refresh is still performed immediately by `Effect.repeat`; the schedule
controls only the follow-up refreshes.

## Code

```ts
import { Effect, Schedule } from "effect"

type DashboardSnapshot = {
  readonly activeUsers: number
  readonly openIncidents: number
  readonly updatedAt: string
}

type DashboardError = {
  readonly _tag: "DashboardError"
  readonly message: string
}

declare const fetchDashboardSnapshot: Effect.Effect<
  DashboardSnapshot,
  DashboardError
>

declare const isDashboardOpen: () => boolean

const refreshWhileOpen = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DashboardSnapshot>(),
  Schedule.passthrough,
  Schedule.while(() => isDashboardOpen())
)

export const dashboardRefresh = Effect.repeat(
  fetchDashboardSnapshot,
  refreshWhileOpen
)
```

`dashboardRefresh` fetches the first snapshot immediately. After each successful
snapshot, the schedule waits for a jittered delay around ten seconds before fetching
again. Across many dashboard sessions, each session chooses its own adjusted delay, so
the backend is less likely to receive all refresh calls at the same instant.

`Schedule.passthrough` keeps the latest `DashboardSnapshot` as the repeat result. That
is useful when the caller wants the final successful snapshot after the dashboard closes
or the surrounding fiber is interrupted.

## Variants

Use a shorter base cadence for dashboards where freshness matters and the endpoint is
cheap. Use a longer cadence when the dashboard aggregates expensive data or serves many
concurrent viewers. The jitter range follows the base cadence: a five-second interval is
jittered to four through six seconds, while a thirty-second interval is jittered to
twenty-four through thirty-six seconds.

If the dashboard should stop after a fixed observation budget, combine the jittered
polling policy with a recurrence limit:

```ts
const refreshAtMostOneHundredTimes = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DashboardSnapshot>(),
  Schedule.passthrough,
  Schedule.while(() => isDashboardOpen()),
  Schedule.bothLeft(
    Schedule.recurs(100).pipe(
      Schedule.satisfiesInputType<DashboardSnapshot>()
    )
  )
)
```

This still returns the latest snapshot because `Schedule.bothLeft` keeps the output from
the polling schedule and uses `Schedule.recurs(100)` only as an additional stop
condition.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It randomly adjusts each recurrence
delay between 80% and 120% of the delay produced by the wrapped schedule.

With `Effect.repeat`, successful dashboard snapshots are fed into the schedule. A
failure from `fetchDashboardSnapshot` stops the repeat unless the fetch effect has its
own retry policy.

Jitter changes timing only. It does not cache responses, limit concurrency, classify
errors, or decide whether the dashboard is still useful to the user. Keep those concerns
explicit around the refresh effect.
