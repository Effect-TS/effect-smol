---
book: "Effect `Schedule` Cookbook"
section_number: "15.7"
section_title: "Reduce herd effects in control planes"
part_title: "Part IV — Polling Recipes"
chapter_title: "15. Adaptive and Fleet-Safe Polling"
status: "draft"
code_included: true
---

# 15.7 Reduce herd effects in control planes

A herd effect is many independent callers hitting the same dependency at the
same time. In control planes, jitter is a small scheduling tool that helps keep
status polling from turning into synchronized bursts.

## Problem

Control planes often expose status for deployment rollouts, cluster membership,
workflow progress, assignment health, or reconciliation. After restarts,
incident recovery, autoscaling, or batch submissions, many callers may begin
polling together and remain aligned on fixed interval boundaries.

Jitter does not make polling rare. It keeps the intended cadence while making
each caller's recurrence delay slightly different.

## When to use it

Use this when many processes, workers, tenants, or browser sessions poll a
control-plane endpoint for read-only status.

It fits cases where a response that is a second early or late is fine, but
synchronized read bursts are expensive.

## When not to use it

Do not use jitter when a control-plane action must happen on an exact
wall-clock boundary.

Do not use jitter as the completion rule. Status values still decide whether an
operation is queued, reconciling, ready, or rejected.

Do not treat jitter as a complete overload strategy. Admission control, quotas,
server-side rate limits, and deployment pacing remain separate concerns.

## Schedule shape

Use a normal control-plane polling interval with `Schedule.spaced`, apply
`Schedule.jittered`, preserve the latest status with `Schedule.passthrough`,
and keep polling only while the operation is active.

Effect's jitter range is fixed at 80% to 120%. A fifteen-second interval becomes
a delay between twelve and eighteen seconds.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type ControlPlaneStatus =
  | { readonly state: "queued"; readonly operationId: string }
  | { readonly state: "reconciling"; readonly operationId: string }
  | { readonly state: "ready"; readonly operationId: string }
  | { readonly state: "rejected"; readonly operationId: string; readonly reason: string }

const scriptedStatuses: ReadonlyArray<ControlPlaneStatus> = [
  { state: "queued", operationId: "op-22" },
  { state: "reconciling", operationId: "op-22" },
  { state: "ready", operationId: "op-22" }
]

let readIndex = 0

const isActive = (status: ControlPlaneStatus): boolean =>
  status.state === "queued" || status.state === "reconciling"

const describeOperation = (
  operationId: string
): Effect.Effect<ControlPlaneStatus> =>
  Effect.sync(() => {
    const status = scriptedStatuses[
      Math.min(readIndex, scriptedStatuses.length - 1)
    ]!
    readIndex += 1
    return status
  }).pipe(
    Effect.tap((status) =>
      Console.log(`[${operationId}] ${status.state}`)
    )
  )

const controlPlanePolling = Schedule.spaced("30 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<ControlPlaneStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isActive(input))
)

const program = describeOperation("op-22").pipe(
  Effect.repeat(controlPlanePolling),
  Effect.tap((status) => Console.log(`control-plane result: ${status.state}`))
)

Effect.runPromise(program).then((status) => {
  console.log("result:", status)
})
```

Each caller chooses its own adjusted delay on each recurrence. Even when callers
start together, later status checks are less likely to stay aligned.

## Variants

Use longer base intervals for expensive control-plane reads or operations that
normally take minutes. Use shorter intervals only for cheap endpoints where
tighter observation is worth the load.

Add a bounded schedule when callers must stop observing non-terminal operations.
Return a distinct "still active" outcome if the bound stops polling before the
control plane reaches a terminal state.

If the control-plane read can fail transiently, add a retry policy to that read
before the repeat.

## Notes and caveats

Client-side jitter reduces accidental alignment among cooperative callers. It
does not protect the control plane from malicious clients, hard capacity
limits, or every caller being triggered by the same external event.

`Effect.repeat` repeats after successful status reads. Failed reads stop the
repeat unless recovered first.

Use `Schedule.satisfiesInputType<T>()` before reading `metadata.input` in
`Schedule.while`.
