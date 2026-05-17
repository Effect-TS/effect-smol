---
book: Effect `Schedule` Cookbook
section_number: "7.4"
section_title: "Capped backoff for worker processes"
part_title: "Part II — Core Retry Recipes"
chapter_title: "7. Retry with Capped Backoff"
status: "draft"
code_included: true
---

# 7.4 Capped backoff for worker processes

Apply capped backoff to one job attempt, not to the whole worker loop.

## Problem

Worker failures often come from overloaded downstream services, temporary
database issues, or rate limits. Immediate retries can amplify the problem, but
uncapped exponential backoff can leave a worker slot asleep longer than the job
lease or shutdown budget allows.

Wrap the single job handler in a capped retry policy. Let the surrounding worker
decide what happens after the job succeeds, exhausts retries, or fails with a
permanent error.

## When to use it

Use this when a worker owns a job for a bounded period and should retry
transient failures before marking the job failed, releasing it, or letting the
queue's own retry mechanism take over.

The retried operation must be safe to run more than once. For external writes,
that usually means idempotency keys, de-duplication, or a transaction boundary.

## When not to use it

Do not wrap an infinite worker loop in one retry policy. A failure from one job
would delay unrelated jobs and make supervision harder.

Do not retry permanent job failures such as invalid payloads, missing data,
authorization failures, or domain errors that another attempt cannot fix.

Do not use the delay cap as a job timeout. It limits each wait between retries,
not total processing time.

## Schedule shape

`Schedule.exponential("25 millis")` capped by `Schedule.spaced("100 millis")`
starts with quick retries and then settles at 100 milliseconds. Pairing that
with `Schedule.recurs(5)` gives one original attempt plus at most five retries.

The cap protects the worker slot from very long sleeps. The retry count protects
the worker from retrying a single job forever.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

interface Job {
  readonly id: string
  readonly payload: string
}

class WorkerError extends Data.TaggedError("WorkerError")<{
  readonly jobId: string
  readonly reason: "DownstreamUnavailable" | "RateLimited" | "InvalidPayload"
}> {}

const job: Job = { id: "job-1", payload: "send-email" }
let attempts = 0

const processJob = (job: Job): Effect.Effect<void, WorkerError> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`process ${job.id}: attempt ${attempts}`)

    if (attempts < 4) {
      return yield* Effect.fail(new WorkerError({
        jobId: job.id,
        reason: "RateLimited"
      }))
    }

    yield* Console.log(`processed ${job.id}`)
  })

const isRetryableWorkerError = (error: WorkerError) =>
  error.reason === "DownstreamUnavailable" || error.reason === "RateLimited"

const workerBackoff = Schedule.exponential("25 millis").pipe(
  Schedule.either(Schedule.spaced("100 millis")),
  Schedule.both(Schedule.recurs(5))
)

const handleJob = (job: Job) =>
  processJob(job).pipe(
    Effect.retry({
      schedule: workerBackoff,
      while: isRetryableWorkerError
    })
  )

Effect.runPromise(handleJob(job)).then(() => undefined, console.error)
```

The job runs immediately. `RateLimited` and `DownstreamUnavailable` use the
capped retry policy. `InvalidPayload` is not retryable, so it bypasses the
schedule and returns to the worker logic immediately.

## Variants

Use a shorter cap when the worker holds a short lease or must respond quickly to
shutdown. Use a longer cap for batch workers that can wait without blocking
urgent work.

Keep the same schedule and change the `while` predicate when only a narrower
set of worker errors should consume retry budget.

## Notes and caveats

Apply the retry policy at the job-handler boundary. The queue poll loop,
acknowledgement logic, and failure recording usually need their own control
flow.

`Schedule.recurs(5)` means five retries after the original attempt. The worker
may call `processJob` up to six times for one job.

The composed schedule output is irrelevant to plain `Effect.retry`; successful
completion still returns the value from `processJob`.
