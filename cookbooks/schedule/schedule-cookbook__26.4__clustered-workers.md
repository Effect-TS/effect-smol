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

Use this recipe to jitter worker polling and retry schedules so a cluster does
not wake up and call shared infrastructure in synchronized bursts.

## Problem

You run many workers against the same queue, lease service, or control-plane
endpoint. When the queue is empty, workers poll for new jobs. When the queue or
job dependency is briefly unavailable, workers retry.

Without jitter, the aggregate behavior can be much harsher than the behavior of
one worker. A single worker polling every five seconds is modest. Two hundred
workers polling every five seconds can become a synchronized burst every five
seconds, especially after a deploy, autoscaling event, queue outage, or process
restart.

Both paths need spreading: the idle polling cadence and the transient retry
backoff should avoid sending follow-up attempts in a single burst.

## When to use it

Use this when many worker processes, pods, fibers, or service instances run the
same recurrence policy against shared infrastructure.

It fits queue consumers, lease refreshers, reconciliation workers, batch
exporters, indexing workers, and status pollers where exact timing is less
important than avoiding synchronized pressure.

Use it when the average rate is acceptable but the burst shape is not. Jitter
does not reduce the amount of work the cluster wants to do; it changes when
individual workers do that work.

## When not to use it

Do not use jitter as a substitute for admission control. If the cluster can
produce more load than the queue, database, or downstream service can handle,
you still need limits such as worker concurrency, queue leases, rate limits, or
server-side backpressure.

Do not use jitter to make unsafe work retryable. Retried job processing still
needs idempotency, deduplication, leases, transactions, or another domain-level
guarantee.

Do not use jitter when a worker must act on exact wall-clock boundaries. Jitter
intentionally moves each recurrence away from the original delay.

## Schedule shape

Use one jittered schedule for empty-queue polling and another for transient
failures:

```ts
const idlePolling = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ClaimResult>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "NoJob"),
  Schedule.bothLeft(
    Schedule.recurs(60).pipe(Schedule.satisfiesInputType<ClaimResult>())
  )
)

const transientRetry = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

`idlePolling` is a repeat schedule. With `Effect.repeat`, successful claim
results are fed into the schedule. It waits around five seconds after a
`NoJob`, keeps the latest claim result as the repeat result, and stops when a
job is claimed or after the recurrence cap is reached.

`transientRetry` is a retry schedule. With `Effect.retry`, typed failures are
fed into the schedule. It starts with exponential backoff at 100 milliseconds,
jitters each retry delay, and stops after at most five retries.

In Effect, `Schedule.jittered` adjusts each recurrence delay between 80% and
120% of the original delay. A five-second idle poll becomes a delay between
four and six seconds. A 100 millisecond retry delay becomes 80 to 120
milliseconds; the next 200 millisecond exponential delay becomes 160 to 240
milliseconds.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

type Job = {
  readonly id: string
  readonly payload: string
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

declare const claimJob: (
  workerId: string
) => Effect.Effect<ClaimResult, QueueUnavailable>

declare const processJob: (
  job: Job
) => Effect.Effect<void, QueueUnavailable | JobFailed>

const idlePolling = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ClaimResult>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "NoJob"),
  Schedule.bothLeft(
    Schedule.recurs(60).pipe(Schedule.satisfiesInputType<ClaimResult>())
  )
)

const transientRetry = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

const waitForClaim = (workerId: string) =>
  claimJob(workerId).pipe(
    Effect.repeat(idlePolling),
    Effect.retry(transientRetry)
  )

export const runWorkerOnce = Effect.fnUntraced(function*(workerId: string) {
  const claim = yield* waitForClaim(workerId)

  if (claim._tag === "NoJob") {
    return "idle" as const
  }

  yield* processJob(claim.job).pipe(
    Effect.retry({
      schedule: transientRetry,
      while: (error) => error._tag === "QueueUnavailable"
    })
  )

  return "processed" as const
})
```

`runWorkerOnce` performs the first claim immediately. If the queue is empty,
the worker repeats the claim after a jittered delay around five seconds. If a
job is claimed, the repeat stops and the job is processed. If the queue is
unavailable while claiming, the whole claim loop is retried with jittered
exponential backoff. If job processing sees `QueueUnavailable`, it uses the
same transient retry policy. A domain failure such as `JobFailed` is not
retried by the processing policy.

Across a cluster, each worker instance owns its own schedule state and samples
its own jitter. The average idle polling rate is still approximately
`worker-count / base-interval`, but the calls are less likely to arrive on the
same instant. With 200 workers and a five-second base interval, the cluster
still wants about 40 idle polls per second on average, but jitter spreads each
round over the four-to-six-second range instead of concentrating it on a
single five-second boundary.

## Variants

Use a longer idle interval when empty queues are normal and latency is not
critical:

```ts
const slowIdlePolling = Schedule.spaced("30 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ClaimResult>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "NoJob")
)
```

A thirty-second base interval jitters each idle delay between twenty-four and
thirty-six seconds.

Use a smaller retry budget for interactive or latency-sensitive workers:

```ts
const shortTransientRetry = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)
```

Use separate retry policies when claiming work and processing work have
different operational costs. Queue claim retries are often cheap and frequent;
job processing retries may need a smaller limit, stronger idempotency checks,
or a dead-letter path.

## Notes and caveats

`Schedule.jittered` changes only the delay. It preserves the schedule output
and does not add a stop condition.

`Schedule.jittered` has fixed bounds in Effect. It randomly adjusts each
recurrence delay between 80% and 120% of the original delay.

With `Effect.repeat`, successful values are schedule inputs. In this recipe,
`Schedule.while` reads each successful `ClaimResult` and repeats only while the
queue reports `NoJob`.

With `Effect.retry`, typed failures are schedule inputs. The retry schedule
does not see successful `ClaimResult` values; it sees failures such as
`QueueUnavailable`.

Jitter improves aggregate shape, not aggregate demand. If every worker polls
forever, the fleet still produces fleet-sized traffic. Use jitter together with
explicit recurrence limits, worker concurrency limits, queue leases, metrics,
and alerting.
