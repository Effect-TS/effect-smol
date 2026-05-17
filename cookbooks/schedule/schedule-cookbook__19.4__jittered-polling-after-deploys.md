---
book: Effect `Schedule` Cookbook
section_number: "19.4"
section_title: "Jittered polling after deploys"
part_title: "Part IV — Polling Recipes"
chapter_title: "19. Poll with Jitter"
status: "draft"
code_included: true
---

# 19.4 Jittered polling after deploys

Deploys often start many polling loops at nearly the same time. Add jitter when
the polling cadence is right for one instance, but many new instances adopting
that cadence together would create avoidable bursts.

## Problem

After a deploy, restart, scale-out, or client release, every new caller may poll
the same rollout or readiness endpoint. With a fixed interval, the first
request wave can be followed by another wave at the same interval boundary.

Jitter keeps the approximate cadence while nudging each later recurrence away
from the shared deploy-time start.

## When to use it

Use this for post-deploy readiness checks, rollout status checks, cache warmup
observation, feature availability polling, and other read-only status checks
that may start in bulk.

It is useful when an exact shared polling boundary has no meaning, but the fleet
should still observe progress regularly.

## When not to use it

Do not use jitter as the deploy readiness rule. The deployment status still
needs to say whether it is starting, ready, or failed.

Do not use this for checks that intentionally sample at fixed wall-clock times,
such as coordinated maintenance-window monitors.

Do not use post-deploy jitter as a rollback rule, timeout, deployment budget, or
capacity limit. Those are separate operational decisions.

## Schedule shape

Use `Schedule.spaced` for the normal post-deploy interval, apply
`Schedule.jittered`, keep the latest deployment status with
`Schedule.passthrough`, and continue while the deployment is still starting.

`Schedule.jittered` changes each recurrence delay to 80% to 120% of the base
delay. A ten-second interval becomes a delay between eight and twelve seconds.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type DeployStatus =
  | { readonly state: "starting"; readonly deploymentId: string; readonly version: string }
  | { readonly state: "ready"; readonly deploymentId: string; readonly version: string }
  | { readonly state: "failed"; readonly deploymentId: string; readonly version: string; readonly reason: string }

const scriptedStatuses: ReadonlyArray<DeployStatus> = [
  { state: "starting", deploymentId: "deploy-17", version: "2026.05.17" },
  { state: "starting", deploymentId: "deploy-17", version: "2026.05.17" },
  { state: "ready", deploymentId: "deploy-17", version: "2026.05.17" }
]

let readIndex = 0

const fetchDeployStatus = (
  deploymentId: string
): Effect.Effect<DeployStatus> =>
  Effect.sync(() => {
    const status = scriptedStatuses[
      Math.min(readIndex, scriptedStatuses.length - 1)
    ]!
    readIndex += 1
    return status
  }).pipe(
    Effect.tap((status) =>
      Console.log(`[${deploymentId}] ${status.version}: ${status.state}`)
    )
  )

const pollAfterDeploy = Schedule.spaced("25 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DeployStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "starting")
)

const program = fetchDeployStatus("deploy-17").pipe(
  Effect.repeat(pollAfterDeploy),
  Effect.tap((status) => Console.log(`deployment ended as ${status.state}`))
)

Effect.runPromise(program).then((status) => {
  console.log("result:", status)
})
```

The first status request runs immediately. If the deployment is still
`"starting"`, later requests wait for jittered delays. Once the status is
`"ready"` or `"failed"`, the repeat stops and returns that terminal status.

## Variants

Use a shorter interval when readiness must be noticed quickly and the endpoint
is cheap. Use a longer interval for slower rollout signals or shared status
services.

Add a recurrence cap when the caller should stop watching after a bounded
number of checks. If the cap fires first, return a separate "not ready in time"
outcome.

Retry transient status-request failures separately from this repeat schedule.
The repeat schedule should describe normal successful polling.

## Notes and caveats

Keep the polled operation read-only. A post-deploy polling loop should observe a
deployment, not submit or resubmit one.

The first request is not delayed. `Schedule.spaced` and `Schedule.jittered`
control recurrences after successful requests.

Apply `Schedule.satisfiesInputType<T>()` before `Schedule.while` when the
predicate reads the latest status.
