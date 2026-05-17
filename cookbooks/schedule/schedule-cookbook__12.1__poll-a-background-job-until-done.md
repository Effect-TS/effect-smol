---
book: "Effect `Schedule` Cookbook"
section_number: "12.1"
section_title: "Poll a background job until done"
part_title: "Part IV — Polling Recipes"
chapter_title: "12. Poll Until Completion"
status: "draft"
code_included: true
---

# 12.1 Poll a background job until done

Use `Effect.repeat` with a spaced schedule when a submitted job exposes a
read-only status endpoint and should be observed until it reaches a terminal
domain state.

## Problem

After submission returns a job id, a successful status check can still report
`"queued"` or `"running"`. Those are ordinary job states, not failures of the
status request. Polling should continue until a terminal state is observed.

## When to use it

Use this when polling is driven by successful observations of a remote job's
state.

This is a good fit for APIs that expose statuses such as `"queued"`,
`"running"`, `"succeeded"`, `"failed"`, or `"canceled"`, where the terminal
states are ordinary successful responses from the status endpoint.

## When not to use it

Do not use this to retry a failing status endpoint. With `Effect.repeat`, a
failure from the status-check effect stops the repeat immediately. Use retry
around the status check when transport or decoding failures should be retried.

Do not use this section as a timeout recipe. This recipe shows the basic polling
shape and a small recurrence cap. Deadline-oriented polling belongs in the
timeout recipes.

Do not treat a domain `"failed"` job status as an effect failure unless your
caller explicitly wants job failure to fail the effect after polling completes.

## Schedule shape

Use a timing schedule for the pause between status checks, constrain its input
to the status type, pass the latest status through as the schedule output, and
continue only while that status is not terminal.

`Schedule.spaced("2 seconds")` supplies the delay before each recurrence.
`Schedule.satisfiesInputType<JobStatus>()` constrains the timing schedule before
the predicate reads `metadata.input`. `Schedule.passthrough` keeps the successful
`JobStatus` as the schedule output, so the repeated effect returns the final
observed status.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "queued" }
  | { readonly state: "running"; readonly percent: number }
  | { readonly state: "succeeded"; readonly resultId: string }
  | { readonly state: "failed"; readonly reason: string }
  | { readonly state: "canceled" }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isTerminal = (status: JobStatus): boolean =>
  status.state === "succeeded" ||
  status.state === "failed" ||
  status.state === "canceled"

let step = 0

const nextStatus = (): JobStatus => {
  step += 1
  switch (step) {
    case 1:
      return { state: "queued" }
    case 2:
      return { state: "running", percent: 40 }
    default:
      return { state: "succeeded", resultId: "result-123" }
  }
}

const checkJobStatus = (jobId: string): Effect.Effect<JobStatus, StatusCheckError> =>
  Effect.gen(function*() {
    const status = nextStatus()
    yield* Console.log(`${jobId}: ${status.state}`)
    return status
  })

const pollUntilTerminal = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)

const program = Effect.gen(function*() {
  const finalStatus = yield* checkJobStatus("job-123").pipe(
    Effect.repeat(pollUntilTerminal)
  )
  yield* Console.log(`final status: ${finalStatus.state}`)
})

Effect.runPromise(program)
```

The example checks immediately, logs two non-terminal statuses, waits briefly
between recurrences, and stops when `"succeeded"` is observed.

The resulting effect succeeds with the terminal `JobStatus` when a terminal
status is observed. It fails with `StatusCheckError` only when a status check
effect fails.

## Variants

Add a recurrence cap when the caller wants to stop after a small number of
observations even if the job is still non-terminal, for example by combining the
status schedule with `Schedule.recurs(30)` using `Schedule.bothLeft`. The result
is still a `JobStatus`: either terminal, or the last non-terminal status before
the cap stopped the repeat.

If a terminal domain state should fail the caller, keep polling until the
terminal status is observed, then handle the final successful value in a
separate step. That keeps polling failures and job-domain failures distinct.

## Notes and caveats

`Schedule.while` sees only successful outputs from the status check. It does not
classify effect failures.

The first status check is not delayed. The schedule controls recurrences after
the first run.

Use `Schedule.passthrough` when composing timing or counting schedules and the
caller needs the final observed status.

When a timing or count schedule is combined with `Schedule.while`, apply
`Schedule.satisfiesInputType<T>()` before reading `metadata.input`.
