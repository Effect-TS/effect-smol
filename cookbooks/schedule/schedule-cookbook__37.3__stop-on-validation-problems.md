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
them before retrying so `Schedule` is used only for failures that can plausibly
recover.

## Problem

An operation such as an order submission can fail because transport is unstable
or because the request itself is invalid. A timeout, connection reset, or
temporary service outage may be worth retrying. Missing fields, invalid values,
business-rule failures, or decode failures should be returned immediately.

Do not attach a retry schedule to the whole error channel before errors are
classified. That repeats malformed requests, increases load, and delays the
useful error the caller needs to fix.

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
and put the classification predicate at the retry boundary. `Schedule.exponential`
supplies growing delays, `Schedule.jittered` spreads those delays, and
`Schedule.recurs(3)` keeps retryable failures to three retries after the
original attempt. The predicate still decides whether a typed failure is
retryable before the next attempt is scheduled.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

let remoteAttempts = 0

const submitOrder = Effect.fnUntraced(function*(request: OrderRequest) {
  yield* Console.log(`submitting order for ${request.email}`)

  if (!request.email.includes("@")) {
    return yield* Effect.fail(
      new SubmitOrderError({
        reason: "InvalidEmail",
        message: "email must contain @"
      })
    )
  }

  if (request.lineItems.length === 0) {
    return yield* Effect.fail(
      new SubmitOrderError({
        reason: "MissingLineItems",
        message: "order must contain at least one item"
      })
    )
  }

  remoteAttempts += 1
  if (remoteAttempts === 1) {
    return yield* Effect.fail(
      new SubmitOrderError({
        reason: "Timeout",
        message: "temporary gateway timeout"
      })
    )
  }

  return { orderId: `order-${remoteAttempts}` } satisfies OrderReceipt
})

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

const runExample = Effect.fnUntraced(function*(
  label: string,
  request: OrderRequest
) {
  yield* Console.log(`\n${label}`)

  yield* submitOrder(request).pipe(
    Effect.retry({
      schedule: submitOrderRetryPolicy,
      while: isRetryableSubmitFailure
    }),
    Effect.matchEffect({
      onFailure: (error) =>
        Console.log(`stopped on ${error.reason}: ${error.message}`),
      onSuccess: (receipt) => Console.log(`created ${receipt.orderId}`)
    })
  )
})

const program = Effect.gen(function*() {
  yield* runExample("valid request retries once", {
    email: "ada@example.com",
    lineItems: ["sku-123"]
  })

  yield* runExample("invalid request stops immediately", {
    email: "invalid-email",
    lineItems: ["sku-123"]
  })
})

Effect.runPromise(program)
```

The valid request fails once with a timeout, then succeeds on retry. The invalid
request fails with `InvalidEmail` and never consumes the retry schedule.

## Variants

When validation is local, keep it before the retried remote call so the
downstream operation is never attempted with invalid input.

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
