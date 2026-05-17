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

Schedules decide whether another recurrence is allowed. They do not, by
themselves, explain why the whole workflow ended. Surface that distinction in
the code around the schedule.

## Problem

You have a scheduled workflow and need callers, logs, or metrics to distinguish
how it ended:

- the operation succeeded
- the schedule was exhausted while the last value or error was still retryable
- a fatal error stopped the workflow
- an elapsed recurrence budget was used up
- a terminal domain state was observed

`Schedule` gives you the recurrence mechanics: cadence, limits, elapsed
budgets, input predicates, and observation hooks. The surrounding Effect code
should turn the final value or failure into a domain-specific termination
reason.

## When to use it

Use this recipe when the final reason affects operations or caller behavior.
This is common for job polling, provisioning workflows, dependency probes,
remote API retries, and background workers where "completed", "failed",
"timed out", and "gave up after retry budget" must be different outcomes.

It is also useful when building metrics. A single counter for "ended" hides the
important question. Separate counters for success, terminal domain failure,
fatal error, and budget exhaustion tell you whether the schedule is helping or
only delaying failure.

## When not to use it

Do not ask the schedule to invent domain meaning. `Schedule.during` does not
throw a timeout error. `Schedule.recurs` and `Schedule.take` do not produce a
"retry budget exhausted" value. They only stop allowing future recurrences.

Do not classify fatal errors as retryable just so the schedule can see them.
Authorization failures, validation failures, malformed requests, and unsafe
non-idempotent writes should normally bypass retry and surface directly.

## Schedule shape

For polling, keep the final observed status as the schedule output, and combine
the domain predicate with an elapsed budget:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Running"),
  Schedule.bothLeft(
    Schedule.during("30 seconds").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  )
)
```

`Schedule.passthrough` makes `Effect.repeat` return the latest successful
`JobStatus`. `Schedule.while` stops once a terminal state is observed.
`Schedule.during` stops once the recurrence budget is exhausted. After
`Effect.repeat` completes, inspect the final status to decide whether it means
completed, terminal failure, or timed out.

For retrying, classify the error before interpreting the final failure:

```ts
Schedule.exponential("200 millis").pipe(
  Schedule.take(5),
  Schedule.while(({ input }) => input._tag === "Transient"),
  Schedule.tapInput((error: RequestError) =>
    Effect.log(`retry input: ${error._tag}`)
  )
)
```

With this shape, a final `Transient` failure means the retry budget was
exhausted. A final `Fatal` failure means the operation stopped because the
error was not retryable.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly _tag: "Running"; readonly jobId: string }
  | { readonly _tag: "Done"; readonly jobId: string; readonly resultId: string }
  | { readonly _tag: "Failed"; readonly jobId: string; readonly reason: string }

type StatusError = {
  readonly _tag: "StatusError"
  readonly message: string
}

type PollTermination =
  | { readonly _tag: "Completed"; readonly status: Extract<JobStatus, { readonly _tag: "Done" }> }
  | { readonly _tag: "TerminalState"; readonly status: Extract<JobStatus, { readonly _tag: "Failed" }> }
  | { readonly _tag: "TimedOut"; readonly lastStatus: Extract<JobStatus, { readonly _tag: "Running" }> }
  | { readonly _tag: "FatalError"; readonly error: StatusError }

declare const checkJobStatus: (
  jobId: string
) => Effect.Effect<JobStatus, StatusError>

const pollUntilTerminalOrBudget = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Running"),
  Schedule.bothLeft(
    Schedule.during("30 seconds").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  ),
  Schedule.tapInput((status) =>
    Effect.log(`job ${status.jobId} status: ${status._tag}`)
  )
)

const pollJob = (jobId: string): Effect.Effect<PollTermination> =>
  Effect.gen(function*() {
    const result = yield* Effect.result(
      checkJobStatus(jobId).pipe(
        Effect.repeat(pollUntilTerminalOrBudget)
      )
    )

    if (result._tag === "Failure") {
      return { _tag: "FatalError", error: result.error } satisfies PollTermination
    }

    switch (result.value._tag) {
      case "Done":
        return { _tag: "Completed", status: result.value }
      case "Failed":
        return { _tag: "TerminalState", status: result.value }
      case "Running":
        return { _tag: "TimedOut", lastStatus: result.value }
    }
  })
```

The polling effect runs once immediately. If it fails, that failure is not fed
to the repeat schedule, so the result is `FatalError`. If it succeeds with
`Done` or `Failed`, the status is fed to the schedule and the schedule stops
because the status is terminal. If it keeps succeeding with `Running` until the
30-second recurrence budget is exhausted, the final successful status is still
`Running`, and the surrounding code maps that to `TimedOut`.

The timeout reason is not produced by `Schedule.during`. It is produced by
looking at the final value returned by `Effect.repeat`.

## Retry variant

For retry workflows, the final failure from `Effect.retry` is the last error
observed. If you need to distinguish exhausted retry budget from fatal error,
make that distinction part of the error model:

```ts
type RequestError =
  | { readonly _tag: "Transient"; readonly reason: string }
  | { readonly _tag: "Fatal"; readonly reason: string }

type RequestTermination<A> =
  | { readonly _tag: "Succeeded"; readonly value: A }
  | { readonly _tag: "RetryBudgetExhausted"; readonly lastError: Extract<RequestError, { readonly _tag: "Transient" }> }
  | { readonly _tag: "FatalError"; readonly error: Extract<RequestError, { readonly _tag: "Fatal" }> }

declare const sendRequest: Effect.Effect<string, RequestError>

const retryTransientOnly = Schedule.exponential("200 millis").pipe(
  Schedule.take(5),
  Schedule.while(({ input }) => input._tag === "Transient")
)

const sendWithReason: Effect.Effect<RequestTermination<string>> =
  Effect.gen(function*() {
    const result = yield* Effect.result(
      sendRequest.pipe(Effect.retry(retryTransientOnly))
    )

    if (result._tag === "Success") {
      return { _tag: "Succeeded", value: result.value }
    }

    switch (result.error._tag) {
      case "Transient":
        return { _tag: "RetryBudgetExhausted", lastError: result.error }
      case "Fatal":
        return { _tag: "FatalError", error: result.error }
    }
  })
```

Here the schedule controls retry timing and limits. The final `Transient` error
means the retry schedule stopped after spending its budget. The final `Fatal`
error means the retry predicate stopped recurrence immediately.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule and returns the
schedule output. Use `Schedule.passthrough` when the final observed value is the
thing you want to interpret afterward.

`Effect.retry` feeds failures into the schedule. When the retry schedule stops,
the effect fails with the last error. If you need to know whether that failure
means "budget exhausted" or "not retryable", encode retryability in the error
type or classify it before retrying.

Elapsed budgets are recurrence budgets. They are checked between attempts or
observations and do not interrupt an already running effect. Use an Effect
timeout around the operation itself when an individual attempt needs a hard
deadline.
