---
book: Effect `Schedule` Cookbook
section_number: "10.3"
section_title: "Retry only on timeouts"
part_title: "Part II — Core Retry Recipes"
chapter_title: "10. Retry Only When It Makes Sense"
status: "draft"
code_included: true
---

# 10.3 Retry only on timeouts

You are calling an operation that can fail for several typed reasons, but only a timeout
should be retried. A timeout often means the caller did not receive an answer in time.
This recipe keeps the retry policy explicit: the schedule decides when another typed
failure should be attempted again and where retrying stops. The surrounding Effect code
remains responsible for domain safety, including which failures are transient, whether
the operation is idempotent, and how the final failure is reported.

## Problem

You are calling an operation that can fail for several typed reasons, but only a
timeout should be retried. A timeout often means the caller did not receive an
answer in time. The same request may still succeed on a later attempt if the
operation is idempotent and the caller can tolerate the extra latency.

Other failures should fail fast. Invalid input, authentication failures,
authorization failures, and decoding errors usually describe a request that will
not become valid just because it is run again.

Use `Effect.retry` with a finite schedule and a `while` predicate that accepts
only the typed timeout failure.

## When to use it

Use this recipe when the error channel distinguishes timeout failures from other
failures. The important point is that timeout is part of the typed error model,
not a string hidden inside a generic error message.

This fits HTTP clients, database calls, RPC clients, queues, and other boundary
operations where timeout is a meaningful retry signal. It is most appropriate
for reads, probes, reconnect attempts, and writes that are protected by an
idempotency key.

It is also useful when a timeout is the only retryable signal. For example, you
may want to retry a slow partner API timeout, while returning a `400`, `401`,
`403`, or decode failure immediately.

## When not to use it

Do not retry every error just because one of the possible errors is a timeout.
Passing only `Schedule.recurs(3)` or `Schedule.exponential("100 millis")` to
`Effect.retry` retries every typed failure produced by the effect.

Do not use this policy for non-idempotent writes unless the operation is
designed to tolerate duplicates. A timeout can mean the response was lost after
the remote side already performed the work.

Do not use timeout-only retry to hide an operation-level timeout for a large
workflow. If several steps can partially succeed before the timed step fails,
put retry around the smallest boundary operation that is safe to run again.

## Schedule shape

`Effect.retry` feeds each typed failure into the retry policy. With the options
form, `while` is evaluated against that failed value. If the predicate returns
`false`, retrying stops immediately and that failure is returned.

```ts
const timeoutRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)
```

The exponential schedule controls the delay between retries. `Schedule.recurs(3)`
allows up to three retries after the original attempt. The `while` predicate is
what prevents non-timeout failures from using that retry budget.

Read the policy as:

- run the operation once immediately
- after a typed timeout failure, back off and retry while attempts remain
- after any non-timeout typed failure, stop immediately
- if all timeout retries are exhausted, return the last timeout failure

## Code

```ts
import { Data, Effect, Schedule } from "effect"

interface Invoice {
  readonly id: string
  readonly total: number
}

class RequestTimeout extends Data.TaggedError("RequestTimeout")<{
  readonly operation: "lookup-invoice"
}> {}

class HttpFailure extends Data.TaggedError("HttpFailure")<{
  readonly status: number
}> {}

class DecodeFailure extends Data.TaggedError("DecodeFailure")<{
  readonly message: string
}> {}

type LookupInvoiceError = RequestTimeout | HttpFailure | DecodeFailure

declare const lookupInvoice: (
  id: string
) => Effect.Effect<Invoice, LookupInvoiceError>

const isRequestTimeout = (
  error: LookupInvoiceError
): error is RequestTimeout => error._tag === "RequestTimeout"

const timeoutRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = lookupInvoice("inv-123").pipe(
  Effect.retry({
    schedule: timeoutRetryPolicy,
    while: isRequestTimeout
  })
)
```

`program` runs `lookupInvoice("inv-123")` once immediately. If it fails with
`RequestTimeout`, the retry policy waits with exponential backoff and tries
again, up to three retries.

If it fails with `HttpFailure` or `DecodeFailure`, `isRequestTimeout` returns
`false`. `Effect.retry` returns that typed failure without scheduling another
attempt.

## Variants

If the timeout comes from `Effect.timeout`, the typed timeout failure is
`Cause.TimeoutError`. Use the guard from `Cause` when the effect can also fail
with domain errors:

```ts
import { Cause, Data, Effect, Schedule } from "effect"

class PartnerFailure extends Data.TaggedError("PartnerFailure")<{
  readonly status: number
}> {}

declare const callPartner: Effect.Effect<string, PartnerFailure>

const timedCall = callPartner.pipe(
  Effect.timeout("2 seconds")
)

const program = timedCall.pipe(
  Effect.retry({
    schedule: Schedule.spaced("200 millis").pipe(
      Schedule.both(Schedule.recurs(2))
    ),
    while: Cause.isTimeoutError
  })
)
```

This retries only the timeout produced by `Effect.timeout`. A `PartnerFailure`
is returned immediately.

For reusable schedules that inspect retry input directly, use schedule input
filtering. The builder form gives the schedule the effect error type, so
`Schedule.while` can inspect the typed failure:

```ts
const program = lookupInvoice("inv-123").pipe(
  Effect.retry(($) =>
    $(Schedule.exponential("100 millis")).pipe(
      Schedule.both(Schedule.recurs(3)),
      Schedule.while(({ input }) => input._tag === "RequestTimeout")
    )
  )
)
```

The options form is usually clearer at a call site. The schedule-filtering form
is useful when you want the retryability rule to live inside a named schedule
that can be reused.

## Notes and caveats

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as timeout failures.

`while` may be a type guard, as in `isRequestTimeout`. With a finite schedule or
`times`, the final error type still includes timeout, because the retry policy
can exhaust while the operation is still timing out.

The first attempt is not delayed. Delays from `Schedule.spaced`,
`Schedule.fixed`, or `Schedule.exponential` apply only after a typed failure has
been accepted by the retry policy.

Keep timeout retry bounded. Use `Schedule.recurs`, `times`, a time budget, or
another stopping condition unless retrying forever is intentional.
