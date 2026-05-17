---
book: Effect `Schedule` Cookbook
section_number: "33.3"
section_title: "Retry with longer spacing after quota signals"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "33. Respect Rate Limits"
status: "draft"
code_included: true
---

# 33.3 Retry with longer spacing after quota signals

Quota signals need slower retry timing than ordinary transient failures. This
recipe builds one bounded schedule that inspects the typed failure and chooses
the next delay from that signal.

## Problem

You call a remote API that can fail with ordinary transient errors and with
quota signals. You want a policy that:

- retries ordinary transient errors after a short delay
- waits much longer after quota signals
- honors a server-provided retry delay when the error contains one
- stops after a small number of retries
- does not retry permanent failures

## When to use it

Use this recipe when the downstream system tells you to slow down: HTTP `429`,
rate-limit headers, quota-exceeded responses, or service-specific throttle
errors. It is a good fit for idempotent client calls and background workers
where a later attempt may succeed after the quota window resets.

This policy is intentionally conservative. It protects the dependency by making
quota failures create slower traffic than ordinary network failures.

## When not to use it

Do not use quota-aware spacing to retry invalid requests. Bad input, missing
credentials, forbidden access, nonexistent resources, and unsafe writes should
fail without retrying.

Also do not use a local schedule as a replacement for a real rate limiter. A
retry schedule controls this failed operation's next attempt; it does not
coordinate all callers sharing the same quota.

## Schedule shape

`Effect.retry` feeds each failure into the schedule as the schedule input.
`Schedule.fromStepWithMetadata` exposes that input together with the recurrence
attempt number. That makes the policy able to say:

- stop when the error is not retryable
- stop after five retries
- wait two seconds for ordinary transient failures
- wait for the server-provided quota delay, or thirty seconds when no precise
  delay is available

The schedule below returns the retry attempt number as its output. The program
does not use that output, but it is useful for logging or metrics if you add
`Schedule.tapOutput`.

## Code

```ts
import { Cause, Duration, Effect, Schedule } from "effect"

type DownstreamError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }
  | {
      readonly _tag: "QuotaExceeded"
      readonly retryAfter: Duration.Duration | undefined
    }
  | { readonly _tag: "BadRequest" }

declare const callDownstream: Effect.Effect<string, DownstreamError>

const isRetryable = (error: DownstreamError) =>
  error._tag === "Timeout" ||
  error._tag === "Unavailable" ||
  error._tag === "QuotaExceeded"

const quotaAwareRetry = Schedule.fromStepWithMetadata(
  Effect.succeed((metadata: Schedule.InputMetadata<DownstreamError>) => {
    const { input, attempt } = metadata

    if (!isRetryable(input) || attempt > 5) {
      return Cause.done(attempt - 1)
    }

    const delay = input._tag === "QuotaExceeded"
      ? input.retryAfter ?? Duration.seconds(30)
      : Duration.seconds(2)

    return Effect.succeed([attempt, delay] as const)
  })
)

export const program = Effect.retry(callDownstream, quotaAwareRetry)
```

## Variants

If every quota signal should use the same local delay, remove `retryAfter` from
the error model and use a fixed delay such as `Duration.seconds(30)`.

If many workers can hit the same quota at once, add randomness to the quota
delay before returning it from the custom step. Randomization avoids making all
workers retry on the same boundary, but keep the upper bound explicit so the
policy remains operationally predictable.

If the API returns precise reset timestamps or rate-limit headers, parse them at
the boundary where you classify the response. The schedule should receive a
domain error such as `QuotaExceeded` with a ready-to-use delay, not raw HTTP
headers scattered through retry logic.

## Notes and caveats

`Schedule.fromStepWithMetadata` is lower-level than `Schedule.exponential` or
`Schedule.spaced`, but it is useful when the next delay depends on the current
input. Returning `Effect.succeed([output, delay])` continues the schedule.
Returning `Cause.done(output)` stops it.

The attempt count belongs to the schedule, not the remote API. In this example,
`attempt > 5` stops after five retries after the original call. That keeps quota
handling bounded even if the downstream service keeps asking the caller to wait.

Longer spacing after quota signals reduces pressure; it does not guarantee
fairness across a fleet. Use shared rate-limit state, queues, or provider
specific quota coordination when multiple processes share the same allowance.
