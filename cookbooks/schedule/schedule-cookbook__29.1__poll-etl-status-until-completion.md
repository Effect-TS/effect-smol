---
book: "Effect `Schedule` Cookbook"
section_number: "29.1"
section_title: "Poll ETL status until completion"
part_title: "Part VII — Real-World Recipes"
chapter_title: "29. Data and Batch Recipes"
status: "draft"
code_included: true
---

# 29.1 Poll ETL status until completion

ETL polling observes work that continues in a data platform after submission.
Treat status responses as domain values; let the schedule decide when to ask
again and let surrounding Effect code interpret the final state.

## Problem

A caller has an ETL run id and needs the last observed status: terminal if the
run finishes, or still active when the polling window expires. Active states
should be spaced out with waits between reads instead of a tight loop.

The status check itself can also hang or fail. That is a separate concern from
the polling schedule: use an operation timeout for each status read, and use a
schedule budget for the overall recurrence window.

## When to use it

Use this when the ETL platform exposes completion as a status endpoint and the
non-terminal statuses are normal successful values.

This is a good fit for batch imports, warehouse loads, dbt or Spark jobs,
materialized-view refreshes, and vendor APIs where completion is observed by
polling a run id.

## When not to use it

Do not use this to hide a broken status endpoint. With `Effect.repeat`, a
failure from the status read stops polling. Add a separate retry policy around
the status read only when transport or decoding failures are transient and safe
to retry.

Do not turn ETL terminal states such as `"failed"` or `"canceled"` into effect
failures inside the polling loop unless every caller wants that behavior. It is
usually clearer to poll until a terminal status is observed, then map the final
status into the caller's domain result.

Do not treat `Schedule.during` as a hard timeout for an in-flight HTTP request.
It is evaluated at recurrence decision points. Use `Effect.timeout` on the
status read when each request needs its own interruption limit.

## Schedule shape

Combine a polling cadence, a terminal-state predicate, and an elapsed recurrence
budget. `Schedule.spaced` waits after each completed status read before the next
poll. `Schedule.while` continues only while the latest successful status is
non-terminal. `Schedule.during` bounds the recurrence window.

`Schedule.passthrough` makes the schedule output the latest `EtlStatus`, and
`Schedule.bothLeft` preserves that output after composing the elapsed budget.
The repeated effect therefore returns the final observed ETL status, not the
schedule's timing or count output.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type EtlStatus =
  | { readonly state: "queued" }
  | { readonly state: "extracting"; readonly rowsRead: number }
  | { readonly state: "loading"; readonly rowsWritten: number }
  | { readonly state: "succeeded"; readonly outputTable: string }
  | { readonly state: "failed"; readonly reason: string }
  | { readonly state: "canceled" }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly message: string
}

const isTerminal = (status: EtlStatus): boolean =>
  status.state === "succeeded" ||
  status.state === "failed" ||
  status.state === "canceled"

const statuses: ReadonlyArray<EtlStatus> = [
  { state: "queued" },
  { state: "extracting", rowsRead: 1_000 },
  { state: "loading", rowsWritten: 1_000 },
  { state: "succeeded", outputTable: "analytics.daily_orders" }
]

let reads = 0

const readEtlStatus: (runId: string) => Effect.Effect<EtlStatus, StatusReadError> =
  Effect.fnUntraced(function*(runId: string) {
    const status = statuses[Math.min(reads, statuses.length - 1)]
    reads += 1
    yield* Console.log(`ETL ${runId} read ${reads}: ${status.state}`)
    return status
  })

const pollEtlStatusBudget = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<EtlStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(Schedule.during("300 millis")),
  Schedule.bothLeft(Schedule.recurs(8))
)

const pollEtlStatus = (runId: string) =>
  readEtlStatus(runId).pipe(
    Effect.timeout("50 millis"),
    Effect.repeat(pollEtlStatusBudget)
  )

const program = pollEtlStatus("etl-run-7").pipe(
  Effect.flatMap((status) =>
    status.state === "succeeded"
      ? Console.log(`ETL completed: ${status.outputTable}`)
      : Console.log(`ETL stopped while ${status.state}`)
  ),
  Effect.catch((error) => Console.log(`ETL status read failed: ${String(error)}`))
)

void Effect.runPromise(program)
```

`pollEtlStatus` performs the first status read immediately. If the first
successful response is `"succeeded"`, `"failed"`, or `"canceled"`, polling stops
without waiting. If the response is still active, the schedule waits before the
next read and continues while the recurrence budget allows another poll.

The effect succeeds with the last observed `EtlStatus`. That status may be
terminal, or it may still be active if the schedule budget stopped allowing
further recurrences. The effect fails only if a status read fails or if a
per-read timeout interrupts a status read.

## Variants

For a user-facing request, shorten both limits: a one-second status-read timeout
and a 30-second recurrence budget often make more sense than a long batch
worker budget.

For a background reconciler, increase the spacing and add `Schedule.jittered`
after the basic policy is correct so many workers do not poll the ETL control
plane at the same instant.

If the caller must fail when the ETL run ends in `"failed"` or `"canceled"`,
keep that decision after polling. This keeps polling mechanics separate from the
business rule for incomplete or unsuccessful ETL runs.

## Notes and caveats

The first status read is not delayed. The schedule controls only recurrences
after a successful status read.

`Effect.repeat` feeds successful `EtlStatus` values into the schedule. Failed
status reads do not become schedule inputs.

`Schedule.during` is a recurrence budget, not a hard deadline for the whole
program. `Effect.timeout` is the per-read timeout in this example.

When a timing schedule reads the latest status through `metadata.input`,
constrain the schedule with `Schedule.satisfiesInputType<EtlStatus>()` before
using `Schedule.while`.
