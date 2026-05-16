---
book: Effect `Schedule` Cookbook
section_number: "48.1"
section_title: "Log each retry attempt"
part_title: "Part XI — Observability and Testing"
chapter_title: "48. Observability, Logging, and Diagnostics"
status: "draft"
code_included: true
---

# 48.1 Log each retry attempt

Retry logs are useful when they answer a production question: what failed,
which policy handled it, and whether another attempt was scheduled. They become
noise when every layer logs the same failure or when a log line says "retrying"
after the retry policy has already stopped.

Use schedule taps to keep retry observability next to the retry policy. With
`Effect.retry`, typed failures are the schedule input, so `Schedule.tapInput`
can observe the error that caused the retry decision. `Schedule.tapOutput`
observes outputs from schedule steps that continue, which is useful for logging
the retry number or delay that was actually scheduled.

## Problem

You have a retried effect and want one clear log event for retry behavior. The
log should include enough context to diagnose transient failures without
turning every failed attempt into a long stack trace or a second copy of the
same application error.

Use `Schedule.tapInput` for the failure context and `Schedule.tapOutput` for
the accepted retry step.

## When to use it

Use this recipe around dependency calls where retry behavior matters during
incident review: HTTP requests, database calls, queue publishing, cache fills,
and startup probes. It fits policies where the retry limit and delay shape are
already explicit, and logging is an observation of that policy rather than a
separate control path.

Log stable fields that operators can group by, such as error tag, endpoint,
operation, retry number, and scheduled delay. Prefer debug-level logs for
high-volume paths and promote only unusual conditions to higher levels.

## When not to use it

Do not use retry logs to compensate for weak error classification. Permanent
errors should usually stop before the schedule spends more time and capacity.

Do not log large request bodies, credentials, response payloads, or full causes
on every retry. Keep retry logs small and structured. The final failure handler
can produce the detailed error report if all retries fail.

Do not add logging at every layer of a call stack. Choose one boundary that owns
the retry policy and log there.

## Schedule shape

`Schedule.tapInput` runs an effect for every input fed to the schedule without
changing the schedule input or output. For `Effect.retry`, that input is the
typed failure from the effect's error channel.

`Schedule.tapOutput` runs an effect for every output produced by the schedule
without changing that output. In a bounded retry schedule, this is the safer
place to log "retry scheduled" because it only runs when the schedule accepts
another recurrence.

The policy in this recipe has three parts:

- `Schedule.exponential("200 millis")` produces the next retry delay
- `Schedule.recurs(5)` limits the policy to five retries after the original
  attempt
- the taps add observability without changing retry timing or stop conditions

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RequestTimeout extends Data.TaggedError("RequestTimeout")<{
  readonly endpoint: string
}> {}

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly endpoint: string
  readonly status: 503 | 504
}> {}

type RequestError = RequestTimeout | ServiceUnavailable

interface InventoryResponse {
  readonly sku: string
  readonly available: boolean
}

declare const fetchInventory: Effect.Effect<InventoryResponse, RequestError>

const retryInventoryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5)),
  Schedule.tapInput((error: RequestError) =>
    Effect.logDebug("retry failure observed").pipe(
      Effect.annotateLogs({
        endpoint: error.endpoint,
        error: error._tag
      })
    )
  ),
  Schedule.tapOutput(([delay, retry]) =>
    Effect.logDebug("retry scheduled").pipe(
      Effect.annotateLogs({
        retry: retry + 1,
        delay: Duration.format(delay)
      })
    )
  )
)

export const program = fetchInventory.pipe(
  Effect.retry(retryInventoryPolicy)
)
```

`program` runs `fetchInventory` once immediately. If it fails with a typed
`RequestError`, the failure is fed to the schedule. The input tap records the
failure tag and endpoint. If the composed schedule still allows another retry,
the output tap records the retry number and exponential delay.

The taps do not affect retry eligibility, delay calculation, or the final
result. If an attempt eventually succeeds, `program` succeeds with the
`InventoryResponse`. If all retries are exhausted, `Effect.retry` propagates
the last typed failure.

## Variants

For very hot paths, log only the accepted schedule output:

```ts
const quietRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5)),
  Schedule.tapOutput(([delay, retry]) =>
    Effect.logDebug("retry scheduled").pipe(
      Effect.annotateLogs({
        retry: retry + 1,
        delay: Duration.format(delay)
      })
    )
  )
)
```

This loses the typed error detail but avoids emitting an input log for a final
failure that is observed by the schedule but not retried.

For a local call site, keep classification in `Effect.retry` options and reuse
the observed schedule:

```ts
const retryTimeoutsOnly = fetchInventory.pipe(
  Effect.retry({
    schedule: retryInventoryPolicy,
    while: (error) => error._tag === "RequestTimeout"
  })
)
```

The schedule still logs retry behavior. The `while` predicate decides whether a
given typed failure is eligible for retry.

## Notes and caveats

`Schedule.tapInput` observes failures before the schedule step completes. With a
bounded schedule, that can include the final failure that exhausts the retry
policy. Use neutral wording such as "retry failure observed" for input logs, or
log "retry scheduled" from `Schedule.tapOutput` when you only want accepted
recurrences.

The retry number in this recipe comes from `Schedule.recurs(5)`, whose output
is zero-based. The log uses `retry + 1` for a human-facing retry count.

Keep retry logs low-cardinality. Error tags, operation names, endpoints, and
retry counts are usually useful. Raw payloads, full URLs with user data, and
unique exception strings are usually too noisy.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures, and they are not inputs to this
retry schedule.
