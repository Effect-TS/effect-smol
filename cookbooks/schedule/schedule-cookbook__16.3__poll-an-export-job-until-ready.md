---
book: Effect `Schedule` Cookbook
section_number: "16.3"
section_title: "Poll an export job until ready"
part_title: "Part IV — Polling Recipes"
chapter_title: "16. Poll Until Completion"
status: "draft"
code_included: true
---

# 16.3 Poll an export job until ready

Use polling when an export service returns an id before the exported file is
ready.

## Problem

For a CSV or report export, the status request can succeed while the export is
still `"running"`. That is a domain state, not an effect failure. The effect
should fail only when the status request itself cannot be performed or decoded.

## When to use it

Use this when an export API separates job creation from file readiness, and the
status endpoint returns ordinary business states such as `"running"`, `"ready"`,
or `"failed"`.

This is a good fit when the caller wants the final observed export status and
can decide what to do with a ready download URL or a failed export reason.

## When not to use it

Do not use this to retry failed status requests. With `Effect.repeat`, a failure
from the status-check effect stops the repeat immediately. If transport failures
should be retried, put retry behavior around the status check separately.

Do not model an export-domain `"failed"` status as an effect failure inside the
polling schedule. Poll until the terminal domain state is observed, then decide
whether that final status should fail the caller.

Do not use this as a timeout recipe. This section shows a polling loop with a
small recurrence cap. Deadline-oriented polling belongs in Chapter 17.

## Schedule shape

Use a spaced schedule for the pause between status checks, preserve the latest
successful export status, and continue only while the export is still running.

`Effect.repeat` runs the first status check immediately. After each successful
check, the resulting `ExportStatus` becomes the schedule input.
`Schedule.while` returns `true` for `"running"` so another check is scheduled,
and returns `false` for `"ready"` or `"failed"` so polling stops.

`Schedule.satisfiesInputType<ExportStatus>()` is applied before reading
`metadata.input`, because `Schedule.spaced` is a timing schedule rather than a
schedule constructed from export statuses. `Schedule.passthrough` keeps the
latest `ExportStatus` as the value returned by the repeated effect.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type ExportStatus =
  | { readonly state: "running"; readonly exportId: string; readonly percent: number }
  | { readonly state: "ready"; readonly exportId: string; readonly downloadUrl: string }
  | { readonly state: "failed"; readonly exportId: string; readonly reason: string }

type ExportStatusError = {
  readonly _tag: "ExportStatusError"
  readonly message: string
}

let step = 0

const nextExportStatus = (exportId: string): ExportStatus => {
  step += 1
  switch (step) {
    case 1:
      return { state: "running", exportId, percent: 25 }
    case 2:
      return { state: "running", exportId, percent: 80 }
    default:
      return {
        state: "ready",
        exportId,
        downloadUrl: "https://example.com/report.csv"
      }
  }
}

const checkExportStatus = (
  exportId: string
): Effect.Effect<ExportStatus, ExportStatusError> =>
  Effect.gen(function*() {
    const status = nextExportStatus(exportId)
    yield* Console.log(`export ${exportId}: ${status.state}`)
    return status
  })

const pollUntilReadyOrFailed = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<ExportStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)

const program = Effect.gen(function*() {
  const finalStatus = yield* checkExportStatus("export-123").pipe(
    Effect.repeat(pollUntilReadyOrFailed)
  )
  yield* Console.log(`final export status: ${finalStatus.state}`)
})

Effect.runPromise(program)
```

The program succeeds with the first non-running status observed. That value may
be `"ready"` with a `downloadUrl`, or `"failed"` with a domain failure reason.

It fails with `ExportStatusError` only when a status check effect fails. A
successful response whose state is `"failed"` is still a successful observation
from the status endpoint.

## Variants

Add a recurrence cap when the caller wants to stop after a bounded number of
status checks even if the export is still running, for example by combining the
status schedule with `Schedule.recurs(40)` using `Schedule.bothLeft`. The final
value can be `"ready"`, `"failed"`, or the last `"running"` status if the cap
stops the repeat first.

If the caller wants ready exports to succeed and failed exports to fail, keep
that decision after polling. The polling schedule should only decide whether to
observe again.

## Notes and caveats

`Schedule.while` inspects successful status values. It does not see effect
failures from `checkExportStatus`.

The first status request is not delayed. `Schedule.spaced("3 seconds")` controls
the delay before later recurrences.

Keep export job creation outside this loop. This recipe repeats read-only status
checks, not the operation that starts the export.

If a capped polling schedule returns a final `"running"` status, the export may
still complete later. Decide separately whether to surface that as "still
pending", enqueue a follow-up check, or escalate to a timeout policy from the
next chapter.
