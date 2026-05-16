---
book: Effect `Schedule` Cookbook
section_number: "5.5"
section_title: "Retry with different fixed delays for different environments"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.5 Retry with different fixed delays for different environments

You want the same retry policy shape in every environment, but the fixed delay should be
different. For example, local development can retry quickly, staging can use a moderate
pause, and production can wait longer between retries. This recipe keeps the retry
policy explicit: the schedule decides when another typed failure should be attempted
again and where retrying stops. The surrounding Effect code remains responsible for
domain safety, including which failures are transient, whether the operation is
idempotent, and how the final failure is reported.

## Problem

You want the same retry policy shape in every environment, but the fixed delay
should be different. For example, local development can retry quickly, staging
can use a moderate pause, and production can wait longer between retries.

Use `Schedule.spaced(delay)` to represent the fixed delay, and choose the delay
before passing the schedule to `Effect.retry`.

## When to use it

Use this recipe when the operation is safe to retry and the only difference
between environments is timing. The retry budget, error filtering, and operation
being retried should stay the same, while the delay changes to fit local,
staging, or production constraints.

This is useful for idempotent requests to local services, short reconnect
attempts, and dependency calls where production should avoid fast retry pressure
but development should still feel responsive.

## When not to use it

Do not use environment-specific delays to hide an unclear retry policy. If
production needs fewer retries, error filtering, backoff, jitter, or a different
fallback, model that explicitly instead of only changing the delay.

Do not use a short fixed production delay for overloaded or rate-limited
dependencies. Those cases usually need backoff, jitter, or a policy derived from
the error response.

Do not retry operations that are not safe to run more than once. Environment
selection changes when retries happen; it does not make repeated side effects
safe.

## Schedule shape

The environment selects one duration, and `Schedule.spaced(duration)` uses that
same duration before every retry. Combined with `Schedule.recurs(3)`, the retry
shape is still bounded:

- attempt 1 runs immediately
- after a typed failure, wait the selected environment delay
- retry up to three times
- if all retries fail, propagate the last typed failure

`Schedule.both` gives the policy intersection semantics. The spaced schedule
contributes the fixed delay, and `Schedule.recurs(3)` contributes the retry
limit. Since the count schedule adds no extra delay, the selected environment
delay is the delay before each retry.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

type Environment = "development" | "staging" | "production"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly reason: string
}> {}

declare const request: Effect.Effect<string, RequestError>

const retryDelay = (environment: Environment): Duration.Input => {
  switch (environment) {
    case "development":
      return "50 millis"
    case "staging":
      return "250 millis"
    case "production":
      return "1 second"
  }
}

const retryPolicy = (environment: Environment) =>
  Schedule.spaced(retryDelay(environment)).pipe(
    Schedule.both(Schedule.recurs(3))
  )

const runRequest = (environment: Environment) =>
  request.pipe(
    Effect.retry(retryPolicy(environment))
  )

const program = runRequest("production")
```

`program` runs `request` once immediately. If it fails with a typed
`RequestError`, it waits one second before each retry and retries up to three
times. Calling `runRequest("development")` keeps the same retry budget but uses
a 50 millisecond delay instead.

## Variants

For a small local policy, the options form can keep the count and schedule
together:

```ts
const runRequestWithOptions = (environment: Environment) =>
  request.pipe(
    Effect.retry({
      schedule: Schedule.spaced(retryDelay(environment)),
      times: 3
    })
  )
```

This has the same retry shape: the schedule supplies the fixed delay, and
`times: 3` supplies the retry limit.

If you prefer a table over a `switch`, store only the durations and build the
schedule from the selected value:

```ts
const retryDelays: Record<Environment, Duration.Input> = {
  development: "50 millis",
  staging: "250 millis",
  production: "1 second"
}

const retryPolicyFromTable = (environment: Environment) =>
  Schedule.spaced(retryDelays[environment]).pipe(
    Schedule.both(Schedule.recurs(3))
  )
```

This keeps the environment-specific part small and makes the shared retry shape
easy to see.

## Notes and caveats

`Schedule.spaced` is the usual fixed-delay constructor for retry policies. It
waits for the given duration after a failure before the next attempt. Do not
confuse this with `Schedule.fixed`, which is for maintaining a fixed recurrence
cadence.

The first attempt is not delayed. The selected delay is used only after a typed
failure and before the next retry attempt.

The environment is selected when you construct the policy. If the environment
can change at runtime, rebuild the policy at the boundary where you call
`Effect.retry`.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.

Keep the retry boundary narrow. Put `Effect.retry` around the request or
operation that can safely be attempted again, not around a larger workflow with
side effects that should not be repeated.
