---
book: Effect `Schedule` Cookbook
section_number: "37.1"
section_title: "Stop on fatal errors"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "37. Stop on Error Conditions"
status: "draft"
code_included: true
---

# 37.1 Stop on fatal errors

Fatal errors should not wait for the retry schedule to decide what to do. The
important step is classification: turn raw downstream failures into domain
errors first, then retry only the class of errors that can realistically succeed
later.

`Effect.retry` feeds each typed failure into the retry policy. When you pass a
`while` predicate with a schedule, the predicate is the retry gate. If it returns
`false`, the failure is returned immediately and the timing schedule is not used
for another attempt.

## Problem

You call a dependency that can fail in two different ways:

- transient errors such as timeouts, temporary unavailability, or quota pressure
- fatal errors such as bad input, missing authorization, or a request that cannot
  ever succeed unchanged

The transient failures should use a bounded retry schedule. The fatal failures
should fail fast so callers see the real problem immediately.

## When to use it

Use this recipe when a single operation can produce both retryable and
non-retryable failures. It is a good fit for HTTP clients, database calls,
message publication, and worker steps where a timeout may recover but a
validation or authorization error should stop the workflow.

The classification belongs next to the boundary that understands the failure.
For example, translate HTTP `408`, `429`, and `503` into transient domain errors,
and translate HTTP `400`, `401`, and `403` into fatal domain errors before
calling `Effect.retry`.

## When not to use it

Do not rely on a retry schedule to discover whether an error is fatal. If the
error is known to be permanent, classify it before retry and let it bypass the
schedule.

Also avoid retrying non-idempotent writes unless the operation has a clear
deduplication or transaction guarantee. A retry policy controls timing; it does
not make an unsafe operation safe to run again.

## Schedule shape

Use a normal timing schedule for retryable failures, then add the retry gate at
the `Effect.retry` call site:

- `schedule` describes spacing and retry budget
- `while` decides whether the current failure is allowed to retry

This keeps the policy readable. The schedule still answers "how often and how
many times?", while the predicate answers "is this error retryable at all?"

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class TransientDownstreamError extends Data.TaggedError("TransientDownstreamError")<{
  readonly reason: "Timeout" | "Unavailable" | "RateLimited"
}> {}

class FatalDownstreamError extends Data.TaggedError("FatalDownstreamError")<{
  readonly reason: "BadRequest" | "Unauthorized" | "Forbidden"
}> {}

type DownstreamError = TransientDownstreamError | FatalDownstreamError

declare const callDownstream: Effect.Effect<string, DownstreamError>

const isTransient = (error: DownstreamError): error is TransientDownstreamError =>
  error._tag === "TransientDownstreamError"

const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5)),
  Schedule.jittered
)

export const program = callDownstream.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: isTransient
  })
)
```

## Variants

For a user-facing request, keep the retry budget small or add a time budget with
`Schedule.during` so the caller gets a prompt answer.

For a background worker, use a larger budget and add logging or metrics around
classification. The useful signal is often "fatal error bypassed retry", not
just "retry exhausted".

If the downstream error contains richer retry information, classify that data
before retry as well. For example, a rate-limit response can become a transient
error with a parsed delay, and a custom schedule can use that delay without
inspecting raw HTTP headers.

## Notes and caveats

`Schedule.recurs(5)` means at most five retries after the original attempt. The
original call is not counted as a schedule recurrence.

`Effect.retry` observes failures, not successes. If `callDownstream` fails with
`FatalDownstreamError`, `while: isTransient` rejects it and the program fails
with that fatal error immediately. If it fails with `TransientDownstreamError`,
the exponential schedule decides the next delay until the retry budget is
exhausted.

Keep fatal and transient error types separate when possible. A single loose
error type with a boolean flag tends to spread retry decisions across the code
base, while tagged domain errors make the stop condition explicit at the retry
boundary.
