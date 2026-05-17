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
opens. Keep the domain readiness rules separate from the schedule that decides
when another observation is allowed.

## Problem

At boot, the service reads a readiness snapshot for the database, broker, and
cache. It should keep polling while any required service is still starting, stop
immediately if a required service reports failure, and return a timeout result
if the fixed startup budget expires.

## When to use it

Use this recipe for boot-time coordination where readiness is eventually consistent and a few seconds of waiting is normal. It fits container startup, deployment hooks, worker initialization, and control-plane checks where the caller needs one final answer: ready, failed, or timed out.

## When not to use it

Do not use polling to paper over a dependency that has an explicit startup event, health stream, or orchestration signal you can subscribe to directly. Also avoid this shape when a failed dependency should not block the current process; in that case, start the process in degraded mode and monitor readiness separately.

## Schedule shape

Use a spaced polling cadence, pass each successful readiness snapshot through as the schedule output, and stop recurring once the latest snapshot is terminal. Combine that with a time budget so startup cannot wait indefinitely.

The first readiness check happens before the schedule decides whether to recur. The schedule controls only the follow-up checks.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

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

declare const readPlatformReadiness: Effect.Effect<ReadinessSnapshot, ReadinessCheckError>

const allReady = (snapshot: ReadinessSnapshot) =>
  snapshot.services.every((service) => service._tag === "Ready")

const failedServices = (snapshot: ReadinessSnapshot) =>
  snapshot.services.filter((service): service is FailedServiceReadiness => service._tag === "Failed")

const isTerminal = (snapshot: ReadinessSnapshot) =>
  allReady(snapshot) || failedServices(snapshot).length > 0

const readinessPolling = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<ReadinessSnapshot>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.both(Schedule.during("45 seconds"))
)

export const waitForRequiredServices = Effect.gen(function*() {
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
```

## Variants

For a single instance startup path, a short fixed cadence is usually enough. For a large fleet, add jitter after choosing the base cadence so many instances do not poll the same platform APIs at the same time. For slow infrastructure, increase the budget deliberately rather than leaving the schedule unbounded.

If readiness reads themselves can fail transiently, handle that separately from terminal service state. For example, retry `readPlatformReadiness` on transport errors with a small retry policy, then repeat successful snapshots with the readiness polling policy.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule, so `Schedule.passthrough` allows the schedule predicate to inspect the latest `ReadinessSnapshot`. The final check after `Effect.repeat` is still necessary: the schedule can stop because every service is ready, because a service failed, or because the time budget was exhausted.

`Schedule.during` is a budget for recurrence decisions, not a replacement for domain classification. Keep terminal states explicit in your readiness model so operators can distinguish "dependency failed" from "startup waited long enough."
