---
book: Effect `Schedule` Cookbook
section_number: "19.2"
section_title: "Jittered polling for dashboards"
part_title: "Part IV — Polling Recipes"
chapter_title: "19. Poll with Jitter"
status: "draft"
code_included: true
---

# 19.2 Jittered polling for dashboards

A dashboard or status page often has many viewers, tabs, panels, or widgets polling the
same read-only endpoint. A fixed interval such as five seconds is easy to reason about,
but it can make every visible widget refresh on the same boundary. This recipe treats
polling as repeated successful observations. The schedule controls cadence and the
condition for taking another observation, while the surrounding Effect code interprets
terminal states, missing data, stale reads, and real failures. Keeping those
responsibilities separate makes the polling loop easier to bound and diagnose.

## Problem

A dashboard or status page often has many viewers, tabs, panels, or widgets
polling the same read-only endpoint. A fixed interval such as five seconds is
easy to reason about, but it can make every visible widget refresh on the same
boundary.

That synchronized refresh pattern creates small traffic spikes. The endpoint
receives a burst, then a quiet gap, then another burst, even though the user
experience only needs a roughly regular refresh cadence.

Add jitter to the polling schedule so each recurrence delay is slightly
different. The dashboard still refreshes around the intended interval, but many
viewers and widgets are less likely to refresh at exactly the same instant.

## When to use it

Use this for dashboard widgets, status pages, monitoring panels, admin screens,
or live summaries that periodically refresh read-only state.

It fits cases where the UI should stay reasonably current, but no viewer needs
the refresh to happen on an exact shared boundary.

Use it when several widgets may be mounted together, many browser tabs may be
open at once, or a shared dashboard is displayed by many users.

## When not to use it

Do not use jitter when the UI must refresh on precise wall-clock boundaries,
such as a clock-aligned report that intentionally updates at the top of every
minute.

Do not use this as a substitute for a stop condition. Jitter changes recurrence
delays; it does not decide when a dashboard widget is no longer relevant.

Do not use dashboard polling jitter as your only protection for an expensive
endpoint. Cache headers, server-side aggregation, quotas, and request collapse
are separate design choices.

## Schedule shape

Start with the normal dashboard refresh interval, add jitter, preserve the
latest status, and continue while the widget still wants live updates:

```ts
Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DashboardStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.mode === "live")
)
```

`Schedule.spaced("5 seconds")` describes the base refresh cadence.
`Schedule.jittered` randomly adjusts each recurrence delay between 80% and
120% of that delay, so the next refresh waits somewhere between four and six
seconds.

`Schedule.satisfiesInputType<DashboardStatus>()` makes the timing schedule
accept dashboard status values before `Schedule.while` reads
`metadata.input`. `Schedule.passthrough` keeps the latest successful status as
the repeated effect's result.

## Code

```ts
import { Effect, Schedule } from "effect"

type DashboardStatus =
  | { readonly mode: "live"; readonly widgetId: string; readonly value: number }
  | { readonly mode: "paused"; readonly widgetId: string; readonly value: number }

type DashboardError = {
  readonly _tag: "DashboardError"
  readonly message: string
}

declare const fetchWidgetStatus: (
  widgetId: string
) => Effect.Effect<DashboardStatus, DashboardError>

const refreshWhileLive = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DashboardStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.mode === "live")
)

const pollDashboardWidget = (widgetId: string) =>
  fetchWidgetStatus(widgetId).pipe(
    Effect.repeat(refreshWhileLive)
  )
```

`pollDashboardWidget` performs the first status request immediately. If that
status says the widget is still `"live"`, the next request waits for a
jittered delay around five seconds. If the status says `"paused"`, the repeat
stops and returns that latest status.

Across many viewers and widgets, each recurrence chooses its own adjusted
delay. Even if several panels mount together, their later refreshes are less
likely to stay aligned.

## Variants

Use a shorter base interval for highly visible widgets where users expect quick
movement, such as a compact incident banner or queue-depth counter. A two
second base interval becomes a jittered delay between 1.6 and 2.4 seconds.

Use a longer base interval for lower-priority panels, historical summaries, or
large dashboards with many widgets. A thirty second base interval becomes a
jittered delay between 24 and 36 seconds.

Add a recurrence cap when a dashboard panel should eventually stop polling
after it has remained live for too long:

```ts
const refreshWhileLiveAtMostOneHundredTimes = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DashboardStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.mode === "live"),
  Schedule.bothLeft(
    Schedule.recurs(100).pipe(Schedule.satisfiesInputType<DashboardStatus>())
  )
)
```

This keeps the latest `DashboardStatus` as the result while also limiting the
number of successful recurrence decisions.

## Notes and caveats

`Schedule.jittered` does not expose configurable jitter bounds. In Effect, it
adjusts each recurrence delay between 80% and 120% of the original delay.

The first dashboard request is not delayed. The schedule controls recurrences
after successful requests.

With `Effect.repeat`, a failure from `fetchWidgetStatus` stops the repeat
unless the status request has its own retry policy.

Keep dashboard polling read-only. A refresh loop should observe current state,
not trigger the work that changes that state.

When a timing schedule reads `metadata.input`, constrain the schedule with
`Schedule.satisfiesInputType<T>()` before `Schedule.while`.
