---
book: Effect `Schedule` Cookbook
section_number: "26.4"
section_title: "Clustered workers"
part_title: "Part VI — Jitter Recipes"
chapter_title: "26. Why Jitter Exists"
status: "draft"
code_included: true
---

# 26.4 Clustered workers

Use jitter so workers in a cluster do not poll or retry shared infrastructure in
synchronized bursts.

## Problem

One worker polling every five seconds is modest. Two hundred workers polling
every five seconds can become a burst every five seconds, especially after a
deploy, autoscaling event, queue outage, or process restart. Transient retry
backoff has the same issue: deterministic delays can align across the cluster.

## When to use it

Use it when many worker processes, pods, fibers, or service instances run the
same recurrence policy against shared queues, lease services, databases, or
control-plane endpoints.

Use it when the average rate is acceptable but the burst shape is not. Jitter
changes when individual workers act; it does not reduce the amount of work the
cluster wants to do.

## When not to use it

Do not use jitter as a substitute for admission control. If the cluster can
produce more load than the dependency can handle, you still need worker
concurrency limits, queue leases, rate limits, or server-side backpressure.

Do not use jitter to make unsafe work retryable. Retried job processing still
needs idempotency, deduplication, leases, transactions, or another domain-level
guarantee.

## Schedule shape

Use one jittered schedule for empty-queue polling and another for transient
failures:

- `Effect.repeat` feeds successful claim results into the idle polling schedule
- `Effect.retry` feeds typed failures into the transient retry schedule
- `Schedule.jittered` spreads each recurrence delay between 80% and 120% of the
  base delay

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

type Job = {
  readonly id: string
}

type ClaimResult =
  | { readonly _tag: "NoJob" }
  | { readonly _tag: "Claimed"; readonly job: Job }

class QueueUnavailable extends Data.TaggedError("QueueUnavailable")<{
  readonly reason: string
}> {}

class JobFailed extends Data.TaggedError("JobFailed")<{
  readonly jobId: string
}> {}

const idlePolling = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ClaimResult>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "NoJob"),
  Schedule.bothLeft(
    Schedule.recurs(3).pipe(Schedule.satisfiesInputType<ClaimResult>())
  )
)

const transientRetry = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const runWorkerOnce = Effect.fnUntraced(function*(workerId: string) {
  let claimAttempts = 0
  let processAttempts = 0

  const claimJob = Effect.gen(function*() {
    claimAttempts += 1
    yield* Console.log(`${workerId} claim attempt ${claimAttempts}`)

    if (workerId === "worker-b" && claimAttempts === 2) {
      return yield* Effect.fail(
        new QueueUnavailable({ reason: "lease service busy" })
      )
    }

    if (claimAttempts < 3) {
      return { _tag: "NoJob" } as ClaimResult
    }

    return {
      _tag: "Claimed",
      job: { id: `${workerId}-job` }
    } as ClaimResult
  })

  const processJob = (job: Job) =>
    Effect.gen(function*() {
      processAttempts += 1
      yield* Console.log(`${workerId} process attempt ${processAttempts}`)

      if (processAttempts === 1) {
        return yield* Effect.fail(
          new QueueUnavailable({ reason: "database reconnecting" })
        )
      }

      if (job.id === "bad-job") {
        return yield* Effect.fail(new JobFailed({ jobId: job.id }))
      }

      yield* Console.log(`${workerId} processed ${job.id}`)
    })

  const claim = yield* claimJob.pipe(
    Effect.repeat(idlePolling),
    Effect.retry(transientRetry)
  )

  if (claim._tag === "NoJob") {
    return `${workerId} idle`
  }

  yield* processJob(claim.job).pipe(
    Effect.retry({
      schedule: transientRetry,
      while: (error) => error._tag === "QueueUnavailable"
    })
  )

  return `${workerId} done`
})

const program = Effect.forEach(
  ["worker-a", "worker-b"],
  runWorkerOnce,
  { concurrency: 2 }
).pipe(
  Effect.flatMap((results) => Console.log(JSON.stringify(results)))
)

Effect.runPromise(program)
```

The idle polling schedule repeats only while the successful claim result is
`NoJob`. The transient retry schedule handles typed infrastructure failures.
Across a cluster, each worker owns its own schedule state and samples its own
jitter.

## Variants

Use a longer idle interval when empty queues are normal and latency is not
critical. Use a smaller retry budget for latency-sensitive workers. Use separate
retry policies when claiming work and processing work have different operational
costs.

## Notes and caveats

`Schedule.jittered` changes only the delay. It preserves the schedule output and
does not add a stop condition.

With `Effect.repeat`, successful values are schedule inputs. With
`Effect.retry`, typed failures are schedule inputs. Jitter improves aggregate
shape, not aggregate demand; keep concurrency limits, leases, metrics, and
alerting in place.
