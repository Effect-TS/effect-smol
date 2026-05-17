---
book: Effect `Schedule` Cookbook
section_number: "45.2"
section_title: "Poll until all required services are ready"
part_title: "Part X — Real-World Recipes"
chapter_title: "45. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 45.2 Poll until all required services are ready

Startup readiness polling coordinates several platform services before traffic
opens. Keep readiness classification in domain code; let the schedule decide
when another successful observation is allowed.

## Problem

At boot, the service reads a readiness snapshot for the database, broker, and
cache. It should keep polling while any required service is still starting, stop
immediately if a required service reports failure, and return a timeout result
if the startup budget expires.

## When to use it

Use this recipe for boot-time coordination where readiness is eventually
consistent and a short wait is normal. It fits container startup, deployment
hooks, worker initialization, and control-plane checks where the caller needs
one final answer: ready, failed, or timed out.

## When not to use it

Do not poll when the dependency provides a reliable startup event, health
stream, or orchestration signal. Also avoid this shape when a failed dependency
should not block the process; start in degraded mode and monitor readiness
separately.

## Schedule shape

Use a spaced cadence, pass each successful readiness snapshot through as the
schedule output, and stop recurring once the latest snapshot is terminal. Add a
budget so startup cannot wait indefinitely.

The first readiness check happens before the schedule decides whether to recur.
The schedule controls only the follow-up checks.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

type ServiceName = "database" | "broker" | "cache"

type ServiceReadiness =
  | { readonly _tag: "Ready"; readonly service: ServiceName }
  | { readonly _tag: "Starting"; readonly service: ServiceName }
  | { readonly _tag: "Failed"; readonly service: ServiceName; readonly reason: string }

type FailedServiceReadiness = Extract<ServiceReadiness, { readonly _tag: "Failed" }>

interface ReadinessSnapshot {
  readonly services: ReadonlyArray<ServiceReadiness>
}

class ReadinessCheckError extends Data.TaggedError("ReadinessCheckError")<{
  readonly reason: string
}> {}

class StartupDependencyFailed extends Data.TaggedError("StartupDependencyFailed")<{
  readonly failed: ReadonlyArray<FailedServiceReadiness>
}> {}

class StartupReadinessTimedOut extends Data.TaggedError("StartupReadinessTimedOut")<{
  readonly latest: ReadinessSnapshot
}> {}

const snapshots: ReadonlyArray<ReadinessSnapshot> = [
  {
    services: [
      { _tag: "Starting", service: "database" },
      { _tag: "Starting", service: "broker" },
      { _tag: "Ready", service: "cache" }
    ]
  },
  {
    services: [
      { _tag: "Ready", service: "database" },
      { _tag: "Starting", service: "broker" },
      { _tag: "Ready", service: "cache" }
    ]
  },
  {
    services: [
      { _tag: "Ready", service: "database" },
      { _tag: "Ready", service: "broker" },
      { _tag: "Ready", service: "cache" }
    ]
  }
]

let reads = 0

const readPlatformReadiness = Effect.gen(function*() {
  const snapshot = snapshots[Math.min(reads, snapshots.length - 1)]
  reads += 1
  const summary = snapshot.services
    .map((service) => `${service.service}:${service._tag}`)
    .join(", ")
  yield* Console.log(
    `readiness ${reads}: ${summary}`
  )
  return snapshot
})

const allReady = (snapshot: ReadinessSnapshot) =>
  snapshot.services.every((service) => service._tag === "Ready")

const failedServices = (snapshot: ReadinessSnapshot) =>
  snapshot.services.filter(
    (service): service is FailedServiceReadiness => service._tag === "Failed"
  )

const isTerminal = (snapshot: ReadinessSnapshot) =>
  allReady(snapshot) || failedServices(snapshot).length > 0

const readinessPolling = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<ReadinessSnapshot>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(Schedule.during("200 millis")),
  Schedule.bothLeft(Schedule.recurs(5))
)

const waitForRequiredServices = Effect.gen(function*() {
  const latest = yield* Effect.repeat(readPlatformReadiness, readinessPolling)
  const failed = failedServices(latest)

  if (failed.length > 0) {
    return yield* Effect.fail(new StartupDependencyFailed({ failed }))
  }

  if (!allReady(latest)) {
    return yield* Effect.fail(new StartupReadinessTimedOut({ latest }))
  }

  return latest
})

const program = waitForRequiredServices.pipe(
  Effect.flatMap(() => Console.log("all required services are ready")),
  Effect.catch((error) => Console.log(`startup stopped: ${error._tag}`))
)

void Effect.runPromise(program)
```

## Variants

For a single instance startup path, a short fixed cadence is usually enough. For
a large fleet, add jitter after choosing the base cadence so instances do not
poll the same platform APIs at the same time. For slow infrastructure, increase
the budget deliberately rather than leaving the schedule unbounded.

If readiness reads themselves can fail transiently, handle that separately from
terminal service state. Retry `readPlatformReadiness` on transport errors with a
small retry policy, then repeat successful snapshots with the readiness polling
policy.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule, so
`Schedule.passthrough` lets the predicate inspect the latest
`ReadinessSnapshot`. The final check after `Effect.repeat` is still necessary:
the schedule can stop because every service is ready, because a service failed,
or because the budget was exhausted.

`Schedule.during` is a budget for recurrence decisions, not a replacement for
domain classification. Keep terminal states explicit so operators can
distinguish "dependency failed" from "startup waited long enough."
