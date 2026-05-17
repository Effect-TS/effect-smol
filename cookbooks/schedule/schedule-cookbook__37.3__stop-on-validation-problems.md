---
book: Effect `Schedule` Cookbook
section_number: "37.3"
section_title: "Stop on validation problems"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "37. Stop on Error Conditions"
status: "draft"
code_included: true
---

# 37.3 Stop on validation problems

Validation problems are input or domain feedback, not timing signals. Classify
them before retrying so `Schedule` only describes mechanics for failures that
can plausibly recover.

## Problem

An operation such as an order submission can fail because transport is unstable
or because the request itself is invalid. A timeout, connection reset, or
temporary service outage may be worth retrying. Missing fields, invalid values,
business-rule failures, or decode failures should be returned immediately.

The mistake is to attach a retry schedule to the whole error channel before the
errors are classified. That turns malformed requests into repeated malformed
requests, increases load, and delays the useful error the caller needs to fix.

## When to use it

Use this recipe when the effect can fail with a typed error union that includes
both retryable infrastructure failures and non-retryable validation failures.
Common examples include form submissions, command handlers, imports, checkout
flows, API writes, and batch jobs that validate each item before sending work to
another system.

It is especially useful at service boundaries where callers need a clear
distinction between "try again later" and "change the request."

## When not to use it

Do not use a schedule to repair invalid input. Normalize, validate, decode, or
reject the input before retrying. If a validation failure might become valid only
after another system changes state, model that as a separate status or
coordination problem rather than retrying the same invalid command blindly.

Do not rely on backoff count exhaustion to stop validation failures. They should
stop on the first observed failure.

## Schedule shape

Use a normal bounded retry schedule for the transient side of the error model,
and put the classification predicate at the retry boundary:

```ts
Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)
```

`Schedule.exponential("100 millis")` supplies growing delays for retryable
failures. `Schedule.jittered` adjusts each delay between 80% and 120% of the
original delay. `Schedule.both(Schedule.recurs(3))` keeps the policy finite:
both schedules must continue, so the operation is retried at most three times
after the original attempt.

The schedule is not the classifier. The predicate decides whether a typed
failure is retryable before the next scheduled attempt is allowed.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class SubmitOrderError extends Data.TaggedError("SubmitOrderError")<{
  readonly reason:
    | "Timeout"
    | "ServiceUnavailable"
    | "InvalidEmail"
    | "MissingLineItems"
  readonly message: string
}> {}

interface OrderRequest {
  readonly email: string
  readonly lineItems: ReadonlyArray<string>
}

interface OrderReceipt {
  readonly orderId: string
}

declare const submitOrder: (
  request: OrderRequest
) => Effect.Effect<OrderReceipt, SubmitOrderError>

const isRetryableSubmitFailure = (error: SubmitOrderError): boolean => {
  switch (error.reason) {
    case "Timeout":
    case "ServiceUnavailable":
      return true
    case "InvalidEmail":
    case "MissingLineItems":
      return false
  }
}

const submitOrderRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const request: OrderRequest = {
  email: "ada@example.com",
  lineItems: ["sku-123"]
}

export const program = submitOrder(request).pipe(
  Effect.retry({
    schedule: submitOrderRetryPolicy,
    while: isRetryableSubmitFailure
  })
)
```

`program` submits the order once immediately. If that attempt fails with
`Timeout` or `ServiceUnavailable`, the retry policy may schedule another
attempt. If it fails with `InvalidEmail` or `MissingLineItems`, retrying stops
immediately and the typed validation failure is returned to the caller.

If every retryable attempt fails, `Schedule.recurs(3)` allows at most three
retries after the original attempt. Once the schedule is exhausted,
`Effect.retry` returns the last typed failure.

## Variants

When validation is a local step, keep it before the retried remote call so the
downstream operation is never attempted with invalid input:

```ts
declare const validateOrder: (
  request: OrderRequest
) => Effect.Effect<OrderRequest, SubmitOrderError>

const validatedProgram = validateOrder(request).pipe(
  Effect.flatMap((validated) =>
    submitOrder(validated).pipe(
      Effect.retry({
        schedule: submitOrderRetryPolicy,
        while: isRetryableSubmitFailure
      })
    )
  )
)
```

For batch imports, classify each item before applying the retry policy for that
item. Validation failures should be recorded as item failures, while retryable
transport failures can use the bounded schedule. This keeps one bad row from
consuming the retry budget intended for transient service failures.

For user-facing requests, keep the retry count small. A fast validation error is
more useful than a delayed response that eventually reports the same invalid
request.

## Notes and caveats

`Effect.retry` feeds typed failures into the retry boundary. The first attempt is
not delayed, and validation failures should not wait for any schedule delay.

`Schedule.exponential` is unbounded by itself. Pair it with `Schedule.recurs`,
`Schedule.during`, `times`, or another explicit stopping condition for the
retryable side of the policy.

`Schedule.both` has intersection semantics: the combined schedule continues only
while both schedules continue. In this recipe, that means the exponential backoff
must still be active and the recurrence limit must not be exhausted.

Keep validation classification close to the effect that creates the typed
failure. If raw downstream errors are mapped into a domain error union, do that
mapping before retry so the predicate can make a stable retryable versus
non-retryable decision.
