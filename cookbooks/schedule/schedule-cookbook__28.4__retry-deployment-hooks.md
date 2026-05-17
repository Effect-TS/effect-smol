---
book: "Effect `Schedule` Cookbook"
section_number: "28.4"
section_title: "Retry deployment hooks"
part_title: "Part VII — Real-World Recipes"
chapter_title: "28. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 28.4 Retry deployment hooks

Deployment hooks bridge a deploy system and external platform services. They
can be retried only when the hook call has a duplicate-safe contract and the
retry policy is bounded.

## Problem

After a deployment reaches the point where post-deploy hooks should run, the
hook endpoint sometimes returns a timeout, `429`, or `503`. The hook operation is
idempotent because the request includes a stable deployment id and hook id, so
the receiver can collapse duplicates.

The retry policy should run the first call immediately, back off after failures,
add jitter for fleet-wide deploys, cap the delay, stop after a small number of
retries, and retry only transient hook failures.

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

Use exponential backoff with jitter, cap each sleep, and combine it with
`Schedule.recurs`. `Effect.retry` feeds typed failures into the schedule, so a
`while` predicate can stop immediately for non-retryable hook errors.

## Example

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class DeploymentHookError extends Data.TaggedError("DeploymentHookError")<{
  readonly status: number
  readonly message: string
}> {}

interface HookReceipt {
  readonly deploymentId: string
  readonly hookName: string
  readonly accepted: boolean
}

let attempts = 0

const invokeDeploymentHook = Effect.fnUntraced(function*(request: {
  readonly deploymentId: string
  readonly hookName: string
  readonly idempotencyKey: string
}) {
  attempts += 1
  yield* Console.log(`hook attempt ${attempts}: ${request.hookName}`)

  if (attempts === 1) {
    return yield* Effect.fail(new DeploymentHookError({
      status: 503,
      message: "hook receiver unavailable"
    }))
  }
  if (attempts === 2) {
    return yield* Effect.fail(new DeploymentHookError({
      status: 429,
      message: "hook receiver is throttling"
    }))
  }

  return {
    deploymentId: request.deploymentId,
    hookName: request.hookName,
    accepted: true
  } satisfies HookReceipt
})

const isRetryableHookError = (error: DeploymentHookError) =>
  error.status === 408 ||
  error.status === 409 ||
  error.status === 429 ||
  error.status >= 500

const deploymentHookRetryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(40)))
  ),
  Schedule.both(Schedule.recurs(5)),
  Schedule.while(({ input }) => isRetryableHookError(input))
)

const program = invokeDeploymentHook({
  deploymentId: "deploy-2026-05-16-001",
  hookName: "post-deploy-smoke-test",
  idempotencyKey: "deploy-2026-05-16-001:post-deploy-smoke-test"
}).pipe(
  Effect.retry(deploymentHookRetryPolicy),
  Effect.flatMap((receipt) =>
    Console.log(`hook accepted: ${receipt.deploymentId}/${receipt.hookName}`)
  ),
  Effect.catch((error: DeploymentHookError) =>
    Console.log(`hook failed with status ${error.status}: ${error.message}`)
  )
)

void Effect.runPromise(program)
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
controls only follow-up retries after a failure, so this policy permits one
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
