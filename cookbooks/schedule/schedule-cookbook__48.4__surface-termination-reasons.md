---
book: Effect `Schedule` Cookbook
section_number: "48.4"
section_title: "Surface termination reasons"
part_title: "Part XI — Observability and Testing"
chapter_title: "48. Observability, Logging, and Diagnostics"
status: "draft"
code_included: true
---

# 48.4 Surface termination reasons

Schedules decide whether another recurrence is allowed. They do not invent
business meaning for the final value or failure. Put that interpretation in the
Effect code around the schedule.

## Problem

Callers and operators need to distinguish success, terminal domain failure,
timeout, fatal read failure, and exhausted retry budget. A schedule gives you
mechanics; your workflow should surface the reason.

## When to use it

Use this for job polling, provisioning workflows, dependency probes, and remote
API retries where "completed", "failed", "timed out", and "gave up" are
different outcomes.

## When not to use it

Do not ask `Schedule.during` to throw a timeout error. It simply stops allowing
future recurrences. Do not classify fatal errors as retryable just so the
schedule can see them.

## Schedule shape

For polling, keep the latest status as output and stop when the status is no
longer running or the budget is exhausted. Then inspect the final value.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type JobStatus =
  | { readonly _tag: "Running"; readonly jobId: string }
  | { readonly _tag: "Done"; readonly jobId: string; readonly resultId: string }
  | { readonly _tag: "Failed"; readonly jobId: string; readonly reason: string }

type PollTermination =
  | { readonly _tag: "Completed" }
  | { readonly _tag: "TerminalFailure"; readonly reason: string }
  | { readonly _tag: "TimedOut"; readonly lastStatus: "Running" }

let reads = 0

const checkJobStatus = Effect.sync((): JobStatus => {
  reads += 1
  const status: JobStatus =
    reads < 4
      ? { _tag: "Running", jobId: "job-1" }
      : { _tag: "Done", jobId: "job-1", resultId: "result-1" }
  console.log(`job status: ${status._tag}`)
  return status
})

const pollUntilTerminalOrBudget = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Running"),
  Schedule.bothLeft(
    Schedule.during("25 millis").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  )
)

const toTermination = (status: JobStatus): PollTermination => {
  switch (status._tag) {
    case "Done":
      return { _tag: "Completed" }
    case "Failed":
      return { _tag: "TerminalFailure", reason: status.reason }
    case "Running":
      return { _tag: "TimedOut", lastStatus: "Running" }
  }
}

const program = checkJobStatus.pipe(
  Effect.repeat(pollUntilTerminalOrBudget),
  Effect.flatMap((status) =>
    Console.log(`termination reason: ${toTermination(status)._tag}`)
  )
)

Effect.runPromise(program)
```

The timeout reason comes from interpreting the final `Running` status. It is
not produced directly by `Schedule.during`.

## Variants

For retry workflows, interpret the final failure from `Effect.retry`: a final
transient error can mean the retry budget was exhausted, while a fatal error
means the retry predicate stopped recurrence immediately.

## Notes and caveats

Keep retryability or terminal-state information in typed domain data. That
makes the final reason explicit instead of hiding it inside timing policy.
