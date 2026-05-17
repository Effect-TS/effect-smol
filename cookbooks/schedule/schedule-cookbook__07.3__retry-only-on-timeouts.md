---
book: "Effect `Schedule` Cookbook"
section_number: "7.3"
section_title: "Retry only on timeouts"
part_title: "Part II — Retry Recipes"
chapter_title: "7. Error-Aware Retries"
status: "draft"
code_included: true
---

# 7.3 Retry only on timeouts

Use this when timeout is the only retryable typed failure for an operation.

## Problem

Build a finite retry policy that accepts only the typed timeout failure. Other
failures, such as HTTP status errors or decode errors, should fail fast.

## When to use it

Use this when the error channel distinguishes timeouts from other failures. The
timeout must be part of the typed error model, not a string embedded in a
generic exception.

This fits HTTP clients, database calls, RPC clients, queues, reconnect probes,
and idempotent writes protected by duplicate-safety guarantees.

## When not to use it

Do not retry every typed error just because timeout is one possible case.
Passing only `Schedule.recurs(3)` or `Schedule.exponential("100 millis")` to
`Effect.retry` retries every typed failure from the effect.

Do not assume timeout means the remote side did nothing. A write timeout can
mean the response was lost after the remote side completed the operation.

## Schedule shape

The schedule supplies the finite retry policy. The `while` predicate prevents
non-timeout failures from consuming that policy.

Read the policy as: run once immediately; after a typed timeout, back off and
retry while attempts remain; after any non-timeout typed failure, stop
immediately.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

const isRequestTimeout = (
  error: LookupInvoiceError
): error is RequestTimeout => error._tag === "RequestTimeout"

const timeoutRetryPolicy = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const makeLookupInvoice = (
  label: string,
  failures: ReadonlyArray<LookupInvoiceError>
): Effect.Effect<Invoice, LookupInvoiceError> => {
  let attempt = 0

  return Effect.gen(function*() {
    attempt += 1
    yield* Console.log(`${label}: lookup attempt ${attempt}`)

    const failure = failures[attempt - 1]
    if (failure !== undefined) {
      return yield* Effect.fail(failure)
    }

    return { id: "inv-123", total: 42 }
  })
}

const runLookup = (
  label: string,
  lookup: Effect.Effect<Invoice, LookupInvoiceError>
) =>
  lookup.pipe(
    Effect.retry({
      schedule: timeoutRetryPolicy,
      while: isRequestTimeout
    }),
    Effect.matchEffect({
      onFailure: (error) => Console.log(`${label}: failed with ${error._tag}`),
      onSuccess: (invoice) => Console.log(`${label}: invoice ${invoice.id}`)
    })
  )

const program = Effect.gen(function*() {
  yield* runLookup(
    "timeout-recovers",
    makeLookupInvoice("timeout-recovers", [
      new RequestTimeout({ operation: "lookup-invoice" }),
      new RequestTimeout({ operation: "lookup-invoice" })
    ])
  )

  yield* runLookup(
    "http-failure",
    makeLookupInvoice("http-failure", [
      new HttpFailure({ status: 403 })
    ])
  )
})

Effect.runPromise(program)
```

The timeout case retries and succeeds. The HTTP failure stops after the first
attempt because the predicate returns `false`.

## Variants and caveats

If the timeout comes from `Effect.timeout`, the typed timeout failure is
`Cause.TimeoutError`; use `Cause.isTimeoutError` as the predicate when the
effect can also fail with domain errors.

Keep timeout retry bounded with `Schedule.recurs`, `times`,
`Schedule.during`, or another stopping condition unless retrying forever is
intentional.

The first attempt is not delayed. Schedule delays apply only after a typed
failure has been accepted by the retry policy.
