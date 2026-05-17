---
book: "Effect `Schedule` Cookbook"
section_number: "12.4"
section_title: "Poll cloud provisioning until ready"
part_title: "Part IV — Polling Recipes"
chapter_title: "12. Poll Until Completion"
status: "draft"
code_included: true
---

# 12.4 Poll cloud provisioning until ready

Use polling when a cloud resource has been accepted for creation but is not
usable yet.

## Problem

After a create request returns a resource id for a database, bucket, cluster,
VM, or service account, the provider exposes a read-only status endpoint.
Successful responses can say that provisioning is still `"pending"` or
`"creating"`, that the resource is `"ready"`, or that provisioning reached a
domain failure such as `"provisioning_failed"`.

Those statuses are part of the cloud resource domain. They are not the same as
effect failures. The status-check effect should fail only when the status could
not be requested, authenticated, parsed, or decoded.

## When to use it

Use this when the status endpoint returns ordinary domain states and the caller
needs the final observed provisioning state.

This is a good fit for workflows where the resource id is already known, polling
is read-only, and `"ready"` and `"provisioning_failed"` are both terminal
answers from the provider.

## When not to use it

Do not use this to repeat the create request. Provisioning APIs often require
idempotency keys or provider-specific conflict handling, and that belongs around
the submit step, not the polling loop.

Do not use this to retry a failing status endpoint by itself. With
`Effect.repeat`, a failure from the status effect stops the repeat immediately.
If transport failures should be retried, apply retry policy inside the status
check or around it before the repeat.

Do not turn a domain status like `"provisioning_failed"` into an effect failure
inside the polling schedule. Poll until the terminal status is observed, then
decide how the caller should handle that final successful value.

## Schedule shape

Poll on a spaced schedule, preserve the latest successful status as the
schedule output, and continue only while the resource is still provisioning.

`Schedule.spaced("5 seconds")` controls the delay before each recurrence.
`Schedule.satisfiesInputType<ProvisioningStatus>()` constrains the timing
schedule before the predicate reads `metadata.input`. `Schedule.passthrough`
keeps the final observed status as the result of `Effect.repeat`.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type ProvisioningStatus =
  | { readonly state: "pending"; readonly resourceId: string }
  | { readonly state: "creating"; readonly resourceId: string }
  | { readonly state: "configuring"; readonly resourceId: string }
  | { readonly state: "ready"; readonly resourceId: string; readonly endpoint: string }
  | { readonly state: "provisioning_failed"; readonly resourceId: string; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isProvisioning = (status: ProvisioningStatus): boolean =>
  status.state === "pending" ||
  status.state === "creating" ||
  status.state === "configuring"

let step = 0

const nextProvisioningStatus = (resourceId: string): ProvisioningStatus => {
  step += 1
  switch (step) {
    case 1:
      return { state: "pending", resourceId }
    case 2:
      return { state: "creating", resourceId }
    default:
      return {
        state: "ready",
        resourceId,
        endpoint: "https://db.example.com"
      }
  }
}

const describeResource = (
  resourceId: string
): Effect.Effect<ProvisioningStatus, StatusCheckError> =>
  Effect.gen(function*() {
    const status = nextProvisioningStatus(resourceId)
    yield* Console.log(`resource ${resourceId}: ${status.state}`)
    return status
  })

const pollUntilReadyOrFailed = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<ProvisioningStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isProvisioning(input))
)

const program = Effect.gen(function*() {
  const finalStatus = yield* describeResource("db-123").pipe(
    Effect.repeat(pollUntilReadyOrFailed)
  )
  yield* Console.log(`final provisioning status: ${finalStatus.state}`)
})

Effect.runPromise(program)
```

The program performs the first status check immediately. If the first
successful response is `"ready"` or `"provisioning_failed"`, the schedule stops
without another request. If the resource is still provisioning, the schedule
waits before checking again.

The returned effect succeeds with the final `ProvisioningStatus`. It fails with
`StatusCheckError` only when `describeResource` fails.

## Variants

Add a recurrence cap when the caller wants to stop after a bounded number of
successful observations, for example by combining the status schedule with
`Schedule.recurs(40)` using `Schedule.bothLeft`. The returned value may be
terminal, or it may be the last non-terminal status observed when the cap
stopped the repeat.

After polling, map the final successful status into the shape your application
needs. For example, a caller may return the ready endpoint, surface a
provisioning failure as a domain error, or store the last non-terminal status
for an operator to inspect.

## Notes and caveats

`Schedule.while` sees successful status values. It does not inspect or recover
effect failures from the status request.

Keep provisioning statuses distinct from request failures. `"ready"` and
`"provisioning_failed"` are terminal domain states; `StatusCheckError` means the
program could not observe the state.

The first status check is not delayed. The schedule controls only recurrences
after the first successful check.

Choose an interval that respects the provider's rate limits and expected
provisioning latency. Deadlines, startup budgets, and fallback behavior are
separate recipes.
