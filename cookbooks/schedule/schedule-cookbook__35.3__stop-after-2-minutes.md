---
book: Effect `Schedule` Cookbook
section_number: "35.3"
section_title: "Stop after 2 minutes"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "35. Stop After a Time Budget"
status: "draft"
code_included: true
---

# 35.3 Stop after 2 minutes

A two-minute budget is useful when a workflow should keep trying long enough for
normal background latency, but should not become an unbounded loop.

Use `Schedule.during("2 minutes")` as the elapsed-time stop condition, and
combine it with a cadence such as `Schedule.spaced`, `Schedule.fixed`, or
`Schedule.exponential`. The cadence says when the next recurrence is allowed.
The budget says when the recurrence window closes.

## Problem

After a user starts an export, the status path may poll for a bounded period
before returning a pending result. In a background worker, the same budget can
bound retries before the message is left for later recovery or surfaced as an
operational failure.

## When to use it

Use this when two minutes is the operational budget for the recurrence itself:
long enough for normal eventual consistency, short enough that callers and
operators get a clear answer.

This is a good fit for background workflows, user-triggered workflows that can
return a pending state, webhook reconciliation, short-lived polling, and retrying
transient dependency failures.

## When not to use it

Do not use a schedule budget as a hard timeout for one in-flight operation. The
schedule is checked at recurrence decision points. If a single request must be
interrupted after two minutes, use `Effect.timeout("2 minutes")` on that request.

Do not use this to retry permanent failures. Validation errors, authorization
errors, malformed requests, and unsafe non-idempotent writes should be classified
before the schedule is applied.

For an interactive HTTP request, two minutes may be too long to hold the
connection open. Prefer starting the work, returning a job identifier or pending
status, and using the two-minute schedule in the worker or status polling path.

## Schedule shape

The usual shape is a cadence combined with `Schedule.during("2 minutes")`.
`Schedule.during` tracks elapsed schedule time and continues only while the
budget is still open. `Schedule.both` requires both schedules to continue, so the
workflow stops when either the cadence schedule stops or the two-minute budget
has elapsed.

## Code

This example polls an export until it reaches a terminal status, but gives the
polling loop no more than two minutes:

```ts
import { Console, Effect, Schedule } from "effect"

type ExportStatus =
  | { readonly _tag: "Processing" }
  | { readonly _tag: "Complete"; readonly downloadUrl: string }
  | { readonly _tag: "Failed"; readonly reason: string }

const statuses: ReadonlyArray<ExportStatus> = [
  { _tag: "Processing" },
  { _tag: "Processing" },
  { _tag: "Complete", downloadUrl: "https://example.com/export.csv" }
]

let reads = 0

const fetchExportStatus: Effect.Effect<ExportStatus> = Effect.gen(function*() {
  const index = yield* Effect.sync(() => {
    const current = reads
    reads += 1
    return current
  })
  const status = statuses[index] ?? statuses[statuses.length - 1]!

  yield* Console.log(`export poll ${index + 1}: ${status._tag}`)
  return status
})

const pollForTwoMinutes = Schedule.identity<ExportStatus>().pipe(
  Schedule.bothLeft(Schedule.spaced("50 millis")),
  Schedule.while(({ output }) => output._tag === "Processing"),
  Schedule.bothLeft(Schedule.during("2 minutes"))
)

const program = fetchExportStatus.pipe(
  Effect.repeat(pollForTwoMinutes),
  Effect.flatMap((status) =>
    status._tag === "Complete"
      ? Console.log(`download ready: ${status.downloadUrl}`)
      : Console.log(`stopped while status was ${status._tag}`)
  )
)

Effect.runPromise(program)
```

`fetchExportStatus` runs immediately. After each successful status check,
`Effect.repeat` feeds the successful `ExportStatus` into the schedule. The
schedule continues only while the latest status is `Processing` and the elapsed
budget is still within two minutes. The example uses a short polling cadence so
it finishes quickly; a production status path might use a cadence such as
`Schedule.spaced("5 seconds")`.

## Variants

For a background worker, use a slower cadence when the downstream system does not
need fast pressure, for example `Schedule.spaced("15 seconds")` with the same
two-minute budget.

For a user-triggered workflow, keep the recurrence budget in the worker or status
check and return a pending state when the budget closes. If the caller must wait
synchronously, combine the schedule budget with an explicit timeout around each
remote call so one slow request cannot consume the whole window.

Add `Schedule.jittered` to fleet-wide retry policies after the base cadence and
budget are correct.

## Notes and caveats

The first run is not delayed by the schedule. The schedule controls later
recurrences after the first success for `Effect.repeat`, or after the first
failure for `Effect.retry`.

`Schedule.during("2 minutes")` does not create a two-minute sleep. It is a stop
condition. Combine it with a cadence to avoid tight repeat loops.

The elapsed budget is checked between attempts. If each attempt has its own
latency risk, add `Effect.timeout` to the attempted operation as well as the
schedule budget.

`Schedule.both` combines outputs. Use `Schedule.bothLeft` when the caller should
receive the domain value from the polling condition rather than a tuple that also
contains the elapsed budget output.
