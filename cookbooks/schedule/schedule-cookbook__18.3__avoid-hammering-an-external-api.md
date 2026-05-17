---
book: "Effect `Schedule` Cookbook"
section_number: "18.3"
section_title: "Avoid hammering an external API"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "18. Spacing and Throttling"
status: "draft"
code_included: true
---

# 18.3 Avoid hammering an external API

Use a schedule to make retry spacing explicit for external APIs. The first call
is immediate, and only follow-up attempts after a failure are paced.

## Problem

You call a third-party API from a worker. The request is replay-safe because it
uses an idempotency key, but the service sometimes responds with a timeout, a
short rate-limit window, or a transient server error. Reviewers should be able
to see:

- how quickly retries start
- how retries spread out over time
- how many extra requests the policy can create
- which failures are allowed to retry
- why the request is safe to replay

## When to use it

Use this recipe when a remote call can be retried but should leave breathing
room between attempts. Typical examples are fetching a generated report,
submitting an idempotent event, refreshing data from a vendor API, or retrying a
temporary `429` from a service with a documented quota.

It is a good fit when retry safety is part of the API contract. The schedule can
limit pressure, but the request still needs to be replayable: use an
idempotency key, a deduplication token, a natural resource identifier, or a
read-only operation.

## When not to use it

Do not use retry spacing to make unsafe side effects safe. Retrying
`POST /payments` or `POST /orders` can duplicate work unless the external API
provides idempotency or another deduplication mechanism.

Do not retry permanent failures such as invalid input, missing credentials,
forbidden access, or a resource that does not exist. Classify those errors
before the schedule is allowed to recur.

Do not treat `Schedule` as a distributed rate limiter. A schedule spaces one
program's recurrences. If many processes share the same vendor quota, combine
this retry policy with a real rate limiter or vendor-provided `Retry-After`
handling.

## Schedule shape

Start with the delay shape, then add guardrails. An exponential schedule
starting at 250 milliseconds grows by the default factor of `2`: about `250ms`,
`500ms`, `1s`, `2s`, and so on. `Schedule.jittered` randomly adjusts each
recurrence delay between `80%` and `120%` of the computed delay, which helps
avoid synchronized retries when many workers fail at the same time.

`Schedule.recurs(5)` bounds the extra requests. `Schedule.during("30 seconds")`
bounds the elapsed retry window when combined with `Schedule.both`. `both` gives
intersection semantics: the combined policy continues only while both component
schedules continue, and it uses the maximum of their delays.

The code below uses shorter durations so it can be pasted into a scratchpad and
finish quickly.

## Example

```ts
import { Console, Data, Effect, Random, Ref, Schedule } from "effect"

class VendorApiError extends Data.TaggedError("VendorApiError")<{
  readonly status: number
  readonly message: string
}> {}

interface Enrichment {
  readonly companyId: string
  readonly riskScore: number
}

const isRetryableVendorFailure = (error: VendorApiError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const vendorRetryPolicy = Schedule.exponential("30 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("1 second")),
  Schedule.while(({ input }) => isRetryableVendorFailure(input))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const enrichCompany = (request: {
    readonly companyId: string
    readonly idempotencyKey: string
  }): Effect.Effect<Enrichment, VendorApiError> =>
    Effect.gen(function*() {
      const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
      yield* Console.log(
        `vendor attempt ${attempt} with key ${request.idempotencyKey}`
      )

      if (attempt === 1) {
        return yield* Effect.fail(
          new VendorApiError({ status: 429, message: "slow down" })
        )
      }

      if (attempt === 2) {
        return yield* Effect.fail(
          new VendorApiError({ status: 503, message: "temporary outage" })
        )
      }

      return { companyId: request.companyId, riskScore: 42 }
    })

  const enrichment = yield* enrichCompany({
    companyId: "company_123",
    idempotencyKey: "enrich-company_123"
  }).pipe(
    Effect.retry(vendorRetryPolicy),
    Random.withSeed("vendor-retry-demo")
  )

  yield* Console.log(`risk score: ${enrichment.riskScore}`)
})

Effect.runPromise(program)
```

The first `enrichCompany` call happens immediately. If it fails with a retryable
`VendorApiError`, `Effect.retry` feeds that failure into the schedule. The
schedule waits for the jittered exponential delay and then allows another
attempt. If the error is not retryable, the retry count is exhausted, or the
elapsed budget is exceeded, the original failure is returned.

## Variants

For a strict published quota, choose a base delay that respects the quota even
under retries. If the API allows one request per second per tenant, a
`Schedule.spaced("1 second")` policy may be clearer than exponential backoff
because it states the minimum gap directly.

For a bursty worker fleet, keep jitter enabled and consider a larger starting
delay. Jitter spreads retries from identical clients, but it does not coordinate
quota across processes.

If the vendor returns `Retry-After`, prefer honoring that response when it is
available. A local schedule is a fallback policy; a server-provided delay is
usually the more accurate rate-limit signal.

## Notes and caveats

`Effect.retry` is failure-driven. It retries only after the effect fails, and it
passes the failure to the schedule as `input`. That is why `Schedule.while` can
inspect `VendorApiError` and stop on non-retryable statuses.

`Schedule.exponential` and `Schedule.spaced` are unbounded by themselves. Always
combine them with a retry count, elapsed budget, domain predicate, or enclosing
lifetime when calling an external API.

Spacing protects the dependency from immediate retry bursts, but it does not
guarantee global compliance with a vendor quota. Use a shared rate limiter when
the limit applies across workers, tenants, or service instances.

Retry safety is separate from timing. Before adding a schedule, make sure the
operation is read-only or replay-safe through idempotency, deduplication, or a
vendor contract that explicitly permits retrying.
