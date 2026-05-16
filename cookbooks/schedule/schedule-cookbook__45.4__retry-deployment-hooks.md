---
book: Effect `Schedule` Cookbook
section_number: "45.4"
section_title: "Retry deployment hooks"
part_title: "Part X — Real-World Recipes"
chapter_title: "45. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 45.4 Retry deployment hooks

Deployment hooks often sit on the boundary between a deploy system and another
platform service: notify an incident tool, refresh a load balancer, start a
smoke test, or record an audit event. Those calls can fail transiently while the
deployment is still valid, but retrying them blindly can duplicate side effects
or create a burst against the same control plane.

Use `Effect.retry` with an explicit `Schedule` when the hook call is safe to
replay. The schedule should answer three operational questions in code: how the
delay backs off, how many retries are allowed, and which failures are still
worth retrying.

## Problem

After a deployment reaches the point where post-deploy hooks should run, the
hook endpoint sometimes returns a timeout, `429`, or `503`. The hook operation is
idempotent because the request includes a stable deployment id and hook id, so
the receiver can collapse duplicates.

You want a retry policy that:

- performs the first hook call immediately
- backs off after each failed retry
- adds jitter so many deployments do not retry together
- caps the maximum delay between attempts
- stops after a fixed number of retries
- retries only transient hook failures

## When to use it

Use this recipe for deployment hooks that have an explicit duplicate-suppression
boundary: an idempotency key, a natural resource identity, or a receiver-side
record keyed by deployment and hook name.

It fits post-deploy notifications, audit writes, cache purge requests, smoke
test triggers, and control-plane updates where a retry can reasonably succeed
after a short outage or rate-limit window.

## When not to use it

Do not retry a hook that is not idempotent. If the receiver creates a ticket,
sends a page, advances a workflow, or mutates deployment state without a
duplicate key, retrying can perform the action more than once.

Do not retry permanent errors. Bad hook configuration, missing credentials,
forbidden access, unknown deployment ids, and validation failures should surface
as deployment problems instead of being hidden behind backoff.

## Schedule shape

`Schedule.exponential("200 millis")` starts with a short retry delay and doubles
the delay after each failure. `Schedule.jittered` spreads callers around that
computed delay so a fleet does not retry in lockstep.

The recipe caps each final delay at five seconds and combines the cadence with
`Schedule.recurs(5)`, so the original hook call may be followed by at most five
scheduled retries. `Schedule.while` reads the failure that `Effect.retry` feeds
into the schedule and stops immediately for non-retryable hook errors.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class DeploymentHookError extends Data.TaggedError("DeploymentHookError")<{
  readonly status: number
  readonly message: string
}> {}

interface HookReceipt {
  readonly deploymentId: string
  readonly hookName: string
  readonly accepted: boolean
}

declare const invokeDeploymentHook: (request: {
  readonly deploymentId: string
  readonly hookName: string
  readonly idempotencyKey: string
}) => Effect.Effect<HookReceipt, DeploymentHookError>

const isRetryableHookError = (error: DeploymentHookError) =>
  error.status === 408 ||
  error.status === 409 ||
  error.status === 429 ||
  error.status >= 500

const deploymentHookRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(5)),
  Schedule.while(({ input }) => isRetryableHookError(input))
)

export const program = invokeDeploymentHook({
  deploymentId: "deploy-2026-05-16-001",
  hookName: "post-deploy-smoke-test",
  idempotencyKey: "deploy-2026-05-16-001:post-deploy-smoke-test"
}).pipe(
  Effect.retry(deploymentHookRetryPolicy)
)
```

## Variants

For a latency-sensitive deploy gate, reduce the retry count or combine the
policy with `Schedule.during` so the deployment controller gets a clear failure
within its rollout budget.

For a best-effort notification hook, keep the deployment path short and enqueue
the hook for a worker that can use a longer retry policy outside the critical
rollout path.

For hooks called by many services at once, keep jitter enabled even when the
maximum delay is low. Backoff reduces pressure after repeated failures; jitter
reduces synchronization across callers.

## Notes and caveats

The original hook call is not counted by `Schedule.recurs(5)`. The schedule
controls only the follow-up retries after a failure, so this policy permits one
initial call plus at most five retries.

`Schedule.exponential` has no retry limit by itself. Always pair it with
`Schedule.recurs`, `Schedule.take`, `Schedule.during`, or a predicate that stops
when retrying no longer makes sense.

Backoff does not make a hook safe to retry. The safety boundary must come from
the hook protocol: a stable idempotency key, deterministic operation identity,
or receiver-side deduplication.

`Effect.retry` feeds `DeploymentHookError` values into the schedule. That is why
`Schedule.while` can classify retryable statuses without mixing sleeps and
counters into the hook implementation.
