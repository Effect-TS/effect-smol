---
book: Effect `Schedule` Cookbook
section_number: "19.5"
section_title: "Reduce herd effects in control planes"
part_title: "Part IV — Polling Recipes"
chapter_title: "19. Poll with Jitter"
status: "draft"
code_included: true
---

# 19.5 Reduce herd effects in control planes

Control planes often have many clients polling for the same kind of status: deployment
rollout state, cluster membership, workflow progress, assignment health, or resource
reconciliation. A fixed polling interval can accidentally align those clients. This
recipe treats polling as repeated successful observations. The schedule controls cadence
and the condition for taking another observation, while the surrounding Effect code
interprets terminal states, missing data, stale reads, and real failures. Keeping those
responsibilities separate makes the polling loop easier to bound and diagnose.

## Problem

Control planes often have many clients polling for the same kind of status:
deployment rollout state, cluster membership, workflow progress, assignment
health, or resource reconciliation.

A fixed polling interval can accidentally align those clients. After a restart,
incident recovery, autoscaling event, or batch submission, many callers may
begin polling at the same time and continue hitting the control plane on the
same interval boundaries.

Use jittered repeat schedules to keep the intended polling cadence while making
individual recurrence delays vary slightly. The goal is not to make polling
rare; it is to avoid turning many independent clients into one synchronized
burst.

## When to use it

Use this when many processes, workers, tenants, or browser sessions poll a
control-plane endpoint for read-only status.

It fits status checks where a response that is a second early or late is fine,
but synchronized bursts are operationally expensive.

Use it when callers may start together, recover together, or receive work in
large batches, and each caller can safely choose its own recurrence timing.

## When not to use it

Do not use jitter when a control-plane action must happen on precise wall-clock
boundaries. Jitter intentionally moves each recurrence around the base delay.

Do not use jitter as the completion rule. It changes when the next status check
happens; it does not decide whether the observed operation is finished.

Do not treat client-side jitter as a complete overload strategy. It can reduce
accidental synchronization, but server-side capacity controls, admission,
quotas, and deployment pacing remain separate concerns.

## Schedule shape

Start with the ordinary control-plane polling interval, add jitter, preserve
the latest status, and continue while the status is still non-terminal:

```ts
Schedule.spaced("15 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ControlPlaneStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "queued" || input.state === "reconciling")
)
```

`Schedule.spaced("15 seconds")` supplies the base delay between successful
status checks. `Schedule.jittered` randomly adjusts each recurrence delay
between 80% and 120% of that delay, so a fifteen-second interval becomes a
delay between twelve and eighteen seconds.

`Schedule.satisfiesInputType<ControlPlaneStatus>()` makes the timing schedule
accept status values before `Schedule.while` reads `metadata.input`.
`Schedule.passthrough` keeps the latest successful status as the repeat result.

## Code

```ts
import { Effect, Schedule } from "effect"

type ControlPlaneStatus =
  | { readonly state: "queued"; readonly operationId: string }
  | { readonly state: "reconciling"; readonly operationId: string }
  | { readonly state: "ready"; readonly operationId: string }
  | { readonly state: "rejected"; readonly operationId: string; readonly reason: string }

type StatusError = {
  readonly _tag: "StatusError"
  readonly message: string
}

const isActive = (status: ControlPlaneStatus): boolean => status.state === "queued" || status.state === "reconciling"

declare const describeOperation: (
  operationId: string
) => Effect.Effect<ControlPlaneStatus, StatusError>

const controlPlanePolling = Schedule.spaced("15 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ControlPlaneStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isActive(input))
)

const waitForControlPlaneOperation = (operationId: string) =>
  describeOperation(operationId).pipe(
    Effect.repeat(controlPlanePolling)
  )
```

`waitForControlPlaneOperation` performs the first status check immediately. If
that status is terminal, the repeat stops. If the operation is still active,
the next check waits for a jittered delay around fifteen seconds.

Across many clients, each repeat schedule chooses its own adjusted delay. Even
when callers begin together, later status checks are less likely to remain
aligned on the same instant.

## Variants

Use a longer base interval for expensive control-plane reads or operations that
normally take minutes. A thirty-second base interval becomes a jittered delay
between twenty-four and thirty-six seconds.

Use a shorter base interval only when the endpoint is cheap and the caller
needs tighter observation. A five-second base interval becomes a jittered delay
between four and six seconds.

Add a recurrence cap when the caller should eventually stop observing a
non-terminal operation:

```ts
const boundedControlPlanePolling = Schedule.spaced("15 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ControlPlaneStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isActive(input)),
  Schedule.bothLeft(
    Schedule.recurs(80).pipe(Schedule.satisfiesInputType<ControlPlaneStatus>())
  )
)
```

This still returns the latest observed `ControlPlaneStatus`. It may be
terminal, or it may be the last active status observed before the recurrence
cap stopped the repeat.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It randomly adjusts each
recurrence delay between 80% and 120% of the original delay.

The first status check is not delayed. The schedule controls recurrences after
successful status checks.

With `Effect.repeat`, a failure from `describeOperation` stops the repeat
unless the status-check effect has its own retry policy.

Client-side jitter reduces accidental alignment among cooperative callers. It
does not protect the control plane from malicious clients, hard capacity
limits, or all clients being forced to poll at exactly the same external event.

When combining timing schedules with status predicates, use
`Schedule.satisfiesInputType<T>()` before reading `metadata.input`.
