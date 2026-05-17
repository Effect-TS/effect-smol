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

Dashboard polling usually needs freshness, not exact clock alignment. Jitter
keeps refreshes near the chosen cadence while spreading reads across viewers,
tabs, and widgets.

## Problem

A dashboard can have many widgets polling the same read-only endpoint. If each
widget refreshes every five seconds and several viewers open the page at once,
the endpoint receives bursts at the same five-second boundaries.

The user experience usually only needs "roughly every five seconds." Adding
jitter makes each recurrence a little early or late, reducing synchronized
refreshes without changing the dashboard's basic behavior.

## When to use it

Use this for dashboard widgets, status pages, monitoring panels, admin screens,
and live summaries that periodically refresh read-only state.

It is a good fit when several panels may mount together or a shared dashboard
may be open in many browser tabs.

## When not to use it

Do not use jitter when the UI intentionally refreshes on wall-clock boundaries,
such as a report that updates at the top of every minute.

Do not use polling jitter as the only protection for an expensive endpoint.
Caching, aggregation, quotas, and request collapse belong outside the schedule.

Do not keep polling after a widget is no longer live. Jitter changes delay
timing; it does not replace a lifecycle or status predicate.

## Schedule shape

Use `Schedule.spaced` for the dashboard refresh interval, then
`Schedule.jittered` to spread recurrences. Use `Schedule.passthrough` and
`Schedule.while` when the latest successful widget status decides whether live
polling should continue.

`Schedule.jittered` uses Effect's built-in 80% to 120% range. With a five-second
base interval, later reads wait between four and six seconds.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type DashboardStatus =
  | { readonly mode: "live"; readonly widgetId: string; readonly value: number }
  | { readonly mode: "paused"; readonly widgetId: string; readonly value: number }

const scriptedStatuses: ReadonlyArray<DashboardStatus> = [
  { mode: "live", widgetId: "queue-depth", value: 14 },
  { mode: "live", widgetId: "queue-depth", value: 11 },
  { mode: "paused", widgetId: "queue-depth", value: 11 }
]

let readIndex = 0

const fetchWidgetStatus = (
  widgetId: string
): Effect.Effect<DashboardStatus> =>
  Effect.sync(() => {
    const status = scriptedStatuses[
      Math.min(readIndex, scriptedStatuses.length - 1)
    ]!
    readIndex += 1
    return status
  }).pipe(
    Effect.tap((status) =>
      Console.log(`[${widgetId}] ${status.mode}: ${status.value}`)
    )
  )

const refreshWhileLive = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DashboardStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.mode === "live")
)

const program = fetchWidgetStatus("queue-depth").pipe(
  Effect.repeat(refreshWhileLive),
  Effect.tap((status) => Console.log(`stopped with ${status.mode}`))
)

Effect.runPromise(program).then((status) => {
  console.log("result:", status)
})
```

The first widget read runs immediately. While the widget reports `"live"`, the
next read waits for a jittered delay. When the widget reports `"paused"`, the
repeat stops and returns that latest status.

## Variants

Use shorter intervals for small, highly visible widgets where stale data is
noticeable. Use longer intervals for low-priority panels or large dashboards
with many widgets.

Add a recurrence cap for dashboards that should stop after a bounded live
window. If the cap stops the schedule first, the final status may still be
`"live"` and should be interpreted as a separate outcome.

If refreshing can fail, retry the individual refresh effect before repeating
it. Keep the normal refresh cadence separate from failure recovery.

## Notes and caveats

Keep dashboard polling read-only. A refresh loop should observe state, not
trigger the work that changes state.

The first request is not delayed by the schedule. Delays apply only before
recurrences after successful requests.

When `Schedule.while` reads `metadata.input`, constrain the schedule first with
`Schedule.satisfiesInputType<T>()`.
