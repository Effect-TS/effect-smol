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

Jitter is useful when many polling loops begin together and a strict shared
boundary is unnecessary. It preserves a familiar cadence while letting later
checks spread out.

## Problem

After a deploy, many instances or clients may start at nearly the same time.
If each one begins polling a status endpoint on the same fixed interval, the
first successful check can turn into a synchronized sequence of later checks.

For example, a newly deployed service might have every replica poll a rollout
status endpoint every ten seconds. The first request from each replica may be
acceptable, but the next wave also lands around the same boundary, followed by
another wave ten seconds later.

Add jitter to the polling schedule used after startup or deploy. Each instance
keeps the same approximate cadence, but its recurrence delays vary slightly, so
the fleet is less likely to keep polling in lockstep.

## When to use it

Use this when a deploy, restart, scale-out, or client release can cause many
polling loops to begin around the same time.

It fits post-deploy readiness checks, rollout status checks, cache warmup
observation, feature availability polling, and other read-only status checks
where an exact shared polling boundary is not important.

Use it when the polling interval is otherwise correct for one caller, but many
new callers may adopt that interval together immediately after deployment.

## When not to use it

Do not use jitter as the deploy readiness rule. Jitter only changes recurrence
delays; it does not decide whether the deployment is ready, failed, or still in
progress.

Do not use this when the check must happen on exact wall-clock boundaries, such
as a coordinated maintenance window monitor that intentionally samples at fixed
times.

Do not use post-deploy polling jitter as a substitute for a deployment budget,
timeout, rollback rule, or capacity limit. Those decisions belong outside the
small timing adjustment described here.

## Schedule shape

Start with the normal post-deploy polling interval, add jitter, keep the latest
status, and continue while the deployed unit is still becoming ready:

```ts
Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DeployStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "starting")
)
```

`Schedule.spaced("10 seconds")` supplies the base recurrence delay.
`Schedule.jittered` randomly adjusts each recurrence delay between 80% and
120% of that delay, so the next check waits somewhere between eight and twelve
seconds.

`Schedule.satisfiesInputType<DeployStatus>()` makes the timing schedule accept
deployment status values before `Schedule.while` reads `metadata.input`.
`Schedule.passthrough` keeps the latest successful status as the repeated
effect's result.

## Code

```ts
import { Effect, Schedule } from "effect"

type DeployStatus =
  | { readonly state: "starting"; readonly deploymentId: string; readonly version: string }
  | { readonly state: "ready"; readonly deploymentId: string; readonly version: string }
  | { readonly state: "failed"; readonly deploymentId: string; readonly version: string; readonly reason: string }

type DeployStatusError = {
  readonly _tag: "DeployStatusError"
  readonly message: string
}

const isStarting = (status: DeployStatus): boolean => status.state === "starting"

declare const fetchDeployStatus: (
  deploymentId: string
) => Effect.Effect<DeployStatus, DeployStatusError>

const pollAfterDeploy = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DeployStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isStarting(input))
)

const waitForDeployStatus = (deploymentId: string) =>
  fetchDeployStatus(deploymentId).pipe(
    Effect.repeat(pollAfterDeploy)
  )
```

`waitForDeployStatus` performs the first status request immediately. If the
deployment is already `"ready"` or `"failed"`, the repeat stops without another
request. If it is still `"starting"`, the next request waits for a jittered
delay around ten seconds.

Each instance evaluates its own schedule. When many instances start polling
after the same deploy, later checks are less likely to remain aligned on the
same ten-second boundary.

## Variants

Use a shorter base interval for deploy checks where readiness should be noticed
quickly and the status endpoint is cheap. A three-second base interval becomes
a jittered delay between 2.4 and 3.6 seconds.

Use a longer base interval for slower rollout signals or shared status
endpoints. A thirty-second base interval becomes a jittered delay between 24
and 36 seconds.

Add a recurrence cap when the caller should stop observing after a bounded
number of successful post-deploy checks:

```ts
const pollAfterDeployAtMostThirtyTimes = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<DeployStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isStarting(input)),
  Schedule.bothLeft(
    Schedule.recurs(30).pipe(Schedule.satisfiesInputType<DeployStatus>())
  )
)
```

This still returns the latest observed `DeployStatus`. It may be terminal, or
it may be the last `"starting"` status observed before the recurrence cap stops
the repeat.

## Notes and caveats

`Schedule.jittered` does not expose configurable jitter bounds. In Effect, it
adjusts each recurrence delay between 80% and 120% of the original delay.

The first status request is not delayed. The schedule controls recurrences
after successful requests.

With `Effect.repeat`, a failure from `fetchDeployStatus` stops the repeat
unless the status request has its own retry policy.

Keep the polling operation read-only. A post-deploy polling loop should observe
deployment state, not submit or re-submit the deployment.

When combining timing schedules with status predicates, use
`Schedule.satisfiesInputType<T>()` before reading `metadata.input`.
