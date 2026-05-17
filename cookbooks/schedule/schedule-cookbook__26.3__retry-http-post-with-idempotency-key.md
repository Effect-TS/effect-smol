---
book: "Effect `Schedule` Cookbook"
section_number: "26.3"
section_title: "Retry HTTP POST with idempotency key"
part_title: "Part VII — Real-World Recipes"
chapter_title: "26. Backend Recipes"
status: "draft"
code_included: true
---

# 26.3 Retry HTTP POST with idempotency key

HTTP `POST` retries need a duplicate-safety contract before any schedule is
added. An idempotency key is a request identifier the server uses to treat
repeated attempts as one logical write.

## Problem

You need to retry an HTTP `POST` when the failure is ambiguous, such as a
timeout, dropped connection, gateway error, or temporary service outage. In
those cases, the client may not know whether the server committed the write.

The retry must reuse the same idempotency key for every attempt. Generating a
fresh key inside the retried effect usually turns retries into independent
writes.

## When to use it

Use this recipe when the downstream HTTP API explicitly supports idempotency
keys for the `POST` endpoint you are calling. Typical examples include payment
creation, order submission, subscription changes, shipment creation, and
command-style API calls.

It is especially useful for failures where the outcome is unknown to the
client: a timeout after the request was sent, a connection reset before the
response arrived, a transient gateway error, or a retryable overload response.

Create or load the idempotency key before entering `Effect.retry`, then pass
that same key to the HTTP request effect on every attempt.

## When not to use it

Do not retry a non-idempotent `POST` unless the downstream service provides a
deduplication contract you can rely on. A local retry schedule cannot make an
unsafe write safe by itself.

Do not retry permanent failures such as invalid payloads, authentication
failures, authorization failures, or domain rejections. Classify those errors
before retrying.

Do not let the retry run forever. Idempotency keys reduce duplicate-write risk;
they do not remove load from a struggling downstream service.

## Schedule shape

Use a bounded schedule for HTTP `POST` retries:

Use exponential backoff so repeated failures slow down, jitter so many clients
do not retry at the same moment, a finite retry count, and an error predicate
that accepts only ambiguous or transient failures.

`Schedule.recurs(4)` means four retries after the initial request. It is not a
total-attempt count.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class PostOrderError extends Data.TaggedError("PostOrderError")<{
  readonly reason:
    | "Timeout"
    | "ConnectionReset"
    | "BadGateway"
    | "ServiceUnavailable"
    | "InvalidRequest"
    | "Unauthorized"
}> {}

interface Order {
  readonly id: string
  readonly status: "Created" | "AlreadyCreated"
}

interface OrderRequest {
  readonly customerId: string
  readonly sku: string
  readonly quantity: number
  readonly idempotencyKey: string
}

let attempts = 0

const postOrder = (request: OrderRequest): Effect.Effect<Order, PostOrderError> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(
      `POST /orders attempt ${attempts} with key ${request.idempotencyKey}`
    )

    if (attempts === 1) {
      return yield* Effect.fail(new PostOrderError({ reason: "Timeout" }))
    }

    return {
      id: "order-1000",
      status: attempts === 2 ? "Created" : "AlreadyCreated"
    }
  })

const retryPost = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const isRetryablePostFailure = (error: PostOrderError): boolean => {
  switch (error.reason) {
    case "Timeout":
    case "ConnectionReset":
    case "BadGateway":
    case "ServiceUnavailable":
      return true
    case "InvalidRequest":
    case "Unauthorized":
      return false
  }
}

const submitOrder = Effect.fnUntraced(function*(
  customerId: string,
  sku: string,
  quantity: number,
  idempotencyKey: string
) {
  return yield* postOrder({ customerId, sku, quantity, idempotencyKey }).pipe(
    Effect.retry({
      schedule: retryPost,
      while: isRetryablePostFailure
    })
  )
})

const program = submitOrder("customer-1", "sku-1", 2, "order-key-123").pipe(
  Effect.tap((order) => Console.log(`order ${order.id}: ${order.status}`))
)

Effect.runPromise(program).then(console.log, console.error)
```

The key detail is that `idempotencyKey` is an input to `submitOrder`. Every
attempt sends the same logical request with the same key.

If the first `POST` succeeds on the server but the response is lost, a later
attempt with the same key should return the same logical result, such as
`Created` or `AlreadyCreated`, according to the downstream API contract.
`Schedule` only decides how many times to ask again and how much delay to put
between attempts.

## Variants

For a user-facing request path, reduce the retry count so the caller gets a
prompt result.

For a background worker or outbox processor, use a larger bounded policy and
persist the idempotency key with the job record.

If the provider returns a specific "already processed" response for a repeated
key, model it as a successful domain value when it represents the same logical
write. Do not turn a successful deduplication response into another retryable
failure.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. The first `POST` attempt runs
immediately; the schedule controls only the follow-up attempts after failures.

`Schedule.recurs(4)` means four retries after the original attempt, not four
total attempts.

The idempotency key must identify one logical command. Reusing the same key for
a different payload can cause the downstream service to reject the request or
return a previous result for the wrong local intent.

Check the downstream API's idempotency-key retention window. Some services
deduplicate keys for hours or days, not forever. Your retry and reconciliation
workflow should fit within that documented window.
