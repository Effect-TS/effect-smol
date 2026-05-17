---
book: Effect `Schedule` Cookbook
section_number: "8.4"
section_title: "Avoid synchronized retries in clustered systems"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: true
---

# 8.4 Avoid synchronized retries in clustered systems

Clustered callers need retry policies that avoid sending every node back to the
same dependency at the same instant.

## Problem

Nodes, pods, workers, or service clients can observe the same failure at roughly
the same time. A shared fixed delay or identical exponential policy can then
create retry waves on the same boundaries.

Add `Schedule.jittered` to the retry schedule. Each caller keeps the same broad
backoff shape, but waits a slightly different amount before retrying.

## When to use it

Use this when the same retry policy may run concurrently in many places:
service replicas, queue consumers, background workers, cluster members, or many
fibers calling the same downstream dependency.

It fits temporary leader unavailability, rolling restarts, short network
partitions, overload responses, and connection pool exhaustion.

## When not to use it

Do not use jitter as the only protection for a cluster that can generate more
retry traffic than the dependency can handle. Jitter reduces alignment, not the
number of callers.

Do not add jitter to hide an unbounded or overly aggressive policy. Cluster
retry policies still need retry limits, timeouts, queue boundaries, circuit
breakers, rate limits, or other operational bounds where appropriate.

## Schedule shape

`Schedule.exponential("15 millis")` produces 15 milliseconds, 30 milliseconds,
60 milliseconds, and so on. `Schedule.jittered` changes those to ranges around
each base delay. `Schedule.recurs(4)` stops each caller after four retries.

The first execution is not delayed. The schedule is consulted only after a
typed failure.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class ClusterRequestError extends Data.TaggedError("ClusterRequestError")<{
  readonly nodeId: string
  readonly reason: "Unavailable" | "Overloaded" | "Partitioned" | "InvalidRequest"
}> {}

const isRetryableClusterError = (error: ClusterRequestError) =>
  error.reason === "Unavailable" ||
  error.reason === "Overloaded" ||
  error.reason === "Partitioned"

const clusteredRetryPolicy = Schedule.exponential("15 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const heartbeatProgram = (nodeId: string) => {
  let attempts = 0

  const sendHeartbeat: Effect.Effect<void, ClusterRequestError> = Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`${nodeId}: heartbeat attempt ${attempts}`)

    if (attempts < 3) {
      return yield* Effect.fail(new ClusterRequestError({
        nodeId,
        reason: "Overloaded"
      }))
    }

    yield* Console.log(`${nodeId}: heartbeat accepted`)
  })

  return sendHeartbeat.pipe(
    Effect.retry({
      schedule: clusteredRetryPolicy,
      while: isRetryableClusterError
    })
  )
}

const program = Effect.all([
  heartbeatProgram("node-a"),
  heartbeatProgram("node-b"),
  heartbeatProgram("node-c")
], { concurrency: "unbounded", discard: true })

Effect.runPromise(program).then(() => undefined, console.error)
```

Each node starts immediately and retries transient cluster errors with the same
base policy. Jitter spreads the retry delays, so the nodes are less likely to
retry in one coordinated burst.

## Variants

For a clustered operation with a steady retry cadence, jitter `Schedule.spaced`
instead of `Schedule.exponential`.

For a capped policy, compose the cap first and then add `Schedule.jittered` if
the capped delay should also be spread. A capped base delay of 5 seconds becomes
a jittered delay between 4 and 6 seconds.

## Notes and caveats

`Schedule.jittered` uses Effect's fixed 80% to 120% range.

Jitter changes retry timing, not retry eligibility. Keep using `while` or
`until` predicates when only some typed failures should be retried.

`Schedule.recurs(4)` means four retries after the original attempt, not four
total executions.
