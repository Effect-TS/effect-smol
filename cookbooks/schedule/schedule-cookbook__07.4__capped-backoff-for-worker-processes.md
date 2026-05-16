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

A worker process pulls jobs from a queue and handles them in the background. Some
failures are transient: a downstream service is overloaded, a database connection is
briefly unavailable, or an external API returns a retryable status. This recipe keeps
the retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

A worker process pulls jobs from a queue and handles them in the background.
Some failures are transient: a downstream service is overloaded, a database
connection is briefly unavailable, or an external API returns a retryable
status. Retrying immediately can amplify the outage, but uncapped exponential
backoff can make one job sleep for too long inside a worker slot.

Use capped backoff for the retry policy around a single job. The worker slows
down after repeated transient failures, but the pause between attempts never
exceeds a known maximum.

## When to use it

Use this recipe when a worker owns a job for a bounded period and should retry
transient failures before marking the job failed, releasing it, or letting the
queue's own retry mechanism take over.

It fits queue consumers, background processors, schedulers, and single-purpose
worker processes where each job has its own retry budget. The cap keeps the
worker responsive to leases, shutdown, supervision, and operational limits.

Use it when the retried operation is safe to run more than once. Job handlers
that write externally should use idempotency keys, de-duplication, or another
domain guarantee before retrying.

## When not to use it

Do not wrap the entire worker loop in one retry policy. If the loop is retried
as a whole, a failure from one job can delay unrelated jobs and make the worker
harder to supervise.

Do not use this policy for permanent job failures such as invalid payloads,
missing required data, authorization failures, or domain errors that another
attempt cannot fix.

Do not rely on the delay cap as a job timeout. The cap limits each wait between
retries; it does not limit total processing time. Use a separate timeout or job
lease mechanism when the whole job must finish by a deadline.

## Schedule shape

Build the cap by combining an exponential schedule with a fixed spaced schedule:

```ts
const workerBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.either(Schedule.spaced("10 seconds")),
  Schedule.both(Schedule.recurs(12))
)
```

`Schedule.exponential("250 millis")` starts with a 250 millisecond delay and
doubles by default: 250 milliseconds, 500 milliseconds, 1 second, 2 seconds, 4
seconds, 8 seconds, 16 seconds, and so on.

`Schedule.spaced("10 seconds")` contributes a constant 10 second delay.
`Schedule.either` continues while either side can continue and uses the minimum
of the two delays. That gives the cap: when the exponential delay is below 10
seconds, the exponential delay wins; when it grows past 10 seconds, the fixed
10 second delay wins.

`Schedule.both(Schedule.recurs(12))` adds a retry budget. `both` continues only
while both schedules continue, so the worker gets at most 12 retries after the
original job attempt.

With `Effect.retry`, the first job attempt runs immediately. The schedule is
consulted only after a typed failure. If the job eventually succeeds, retrying
stops. If the retry budget is exhausted, the last typed failure is returned to
the surrounding worker logic.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

interface Job {
  readonly id: string
  readonly payload: string
}

class WorkerError extends Data.TaggedError("WorkerError")<{
  readonly jobId: string
  readonly reason: "DownstreamUnavailable" | "RateLimited" | "InvalidPayload"
}> {}

declare const processJob: (job: Job) => Effect.Effect<void, WorkerError>
declare const markJobFailed: (job: Job, error: WorkerError) => Effect.Effect<void>

const isRetryableWorkerError = (error: WorkerError) =>
  error.reason === "DownstreamUnavailable" || error.reason === "RateLimited"

const workerBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.either(Schedule.spaced("10 seconds")),
  Schedule.both(Schedule.recurs(12))
)

const handleJob = (job: Job) =>
  processJob(job).pipe(
    Effect.retry({
      schedule: workerBackoff,
      while: isRetryableWorkerError
    }),
    Effect.catchAll((error) => markJobFailed(job, error))
  )
```

`handleJob` runs `processJob(job)` once immediately. If the job fails with
`DownstreamUnavailable` or `RateLimited`, the worker retries with capped
backoff. The first retry waits 250 milliseconds, then later retry delays grow
to 500 milliseconds, 1 second, 2 seconds, 4 seconds, and 8 seconds. Once the
exponential delay would exceed 10 seconds, each later retry waits 10 seconds.

If `processJob` fails with `InvalidPayload`, the `while` predicate rejects the
failure and retrying stops immediately. If all permitted retries fail,
`Effect.retry` returns the last `WorkerError`, and `markJobFailed` records the
job failure outside the retry policy.

## Variants

Use a shorter cap when the worker holds a short job lease:

```ts
const leaseAwareBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("2 seconds")),
  Schedule.both(Schedule.recurs(6))
)
```

This gives the job a few quick retries without spending a long time asleep in
the worker slot.

Use a larger cap for slow batch workers:

```ts
const batchWorkerBackoff = Schedule.exponential("1 second").pipe(
  Schedule.either(Schedule.spaced("30 seconds")),
  Schedule.both(Schedule.recurs(20))
)
```

This is more appropriate when a worker can hold a job for longer and the
downstream dependency may need more time to recover.

Keep the same schedule and change the retry predicate when only some worker
errors should consume retry budget:

```ts
const retryOnlyRateLimits = (error: WorkerError) => error.reason === "RateLimited"

const handleRateLimitedJob = (job: Job) =>
  processJob(job).pipe(
    Effect.retry({
      schedule: workerBackoff,
      while: retryOnlyRateLimits
    }),
    Effect.catchAll((error) => markJobFailed(job, error))
  )
```

The schedule controls timing and count. The predicate controls which typed
failures are allowed to use that schedule.

## Notes and caveats

There is no dedicated cap constructor in this recipe. The cap comes from
`Schedule.either(Schedule.spaced(maxDelay))`, because `either` uses the minimum
delay from the two schedules.

Apply the retry policy to one job handler, not to the infinite worker loop. That
keeps unrelated jobs from inheriting another job's backoff delay.

`Schedule.recurs(12)` means 12 retries after the original attempt, not 12 total
job attempts. The worker may call `processJob` up to 13 times for one job.

The cap is per retry delay. The total time spent on a job can still be much
larger than the cap because the worker may wait many times.

The output of the composed schedule is nested schedule output. Plain
`Effect.retry` uses it for retry timing and stopping decisions, then returns the
successful value from `processJob` when an attempt succeeds.
