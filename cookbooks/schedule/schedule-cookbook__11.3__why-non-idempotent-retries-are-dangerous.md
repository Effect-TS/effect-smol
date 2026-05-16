---
book: Effect `Schedule` Cookbook
section_number: "11.3"
section_title: "Why non-idempotent retries are dangerous"
part_title: "Part II — Core Retry Recipes"
chapter_title: "11. Idempotency and Retry Safety"
status: "draft"
code_included: true
---

# 11.3 Why non-idempotent retries are dangerous

This subsection explains Why non-idempotent retries are dangerous as a practical Effect
`Schedule` recipe. This recipe keeps the retry policy explicit: the schedule decides
when another typed failure should be attempted again and where retrying stops. The
surrounding Effect code remains responsible for domain safety, including which failures
are transient, whether the operation is idempotent, and how the final failure is
reported.

## The anti-pattern

A retry policy is easy to attach to any failing effect:

```ts
import { Effect, Schedule } from "effect"

declare const chargeCustomer: Effect.Effect<void, Error>

const retryWrites = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = chargeCustomer.pipe(
  Effect.retry(retryWrites)
)
```

This shape is technically valid, but it is dangerous when `chargeCustomer`
performs a non-idempotent side effect. `Effect.retry` runs the original effect
once and then runs it again while the schedule allows another retry. If the
effect fails after the external system already accepted the charge, the next
attempt can create a second charge.

The same anti-pattern appears with email delivery, inventory updates, shipment
creation, ticket creation, one-way webhook calls, and external systems that do
not give the caller a reliable duplicate-suppression boundary.

## Why it happens

Retries are driven by what the caller can observe. A timeout, dropped
connection, `503`, or connection reset tells the caller that it did not receive
a successful response. It does not prove that the downstream system did
nothing.

For a read, this uncertainty is usually acceptable. Running the same lookup
again normally produces another observation of the same resource. For a write,
the uncertainty crosses a boundary: the downstream service may have committed
the side effect and then failed before the response reached the caller.

`Schedule` controls when and how often the effect is attempted again. It does
not change the meaning of the side effect being retried. A careful schedule can
reduce load and limit attempts, but it cannot make a non-idempotent operation
safe by itself.

## Why it is risky

Non-idempotent retries turn ambiguous failures into duplicate business actions.
A payment retry can double-charge a customer. An email retry can send the same
message multiple times. An inventory retry can decrement stock twice. A webhook
retry can trigger another system to create duplicate records.

The operational damage is often larger than the immediate failure. Duplicate
charges need refunds and support handling. Duplicate emails erode trust and may
trip abuse controls. Duplicate inventory updates can oversell products or block
valid orders. Duplicate one-way calls are hard to unwind because the caller may
not own the downstream state.

Attempt limits do not remove this risk:

```ts
const boundedButStillUnsafe = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(2))
)
```

This policy limits the damage to two retries after the original attempt. It
does not answer the important question: is it safe for the external side effect
to happen three times?

## A better approach

Place retries around effects that are safe to re-run, and keep unsafe writes
outside generic retry wrappers unless the external protocol provides a
duplicate-safe boundary.

```ts
import { Effect, Schedule } from "effect"

declare const reserveLocalOrderNumber: Effect.Effect<string, Error>
declare const submitChargeOnce: (orderNumber: string) => Effect.Effect<void, Error>

const retryTransientPreparation = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = Effect.gen(function*() {
  const orderNumber = yield* reserveLocalOrderNumber.pipe(
    Effect.retry(retryTransientPreparation)
  )

  yield* submitChargeOnce(orderNumber)
})
```

Here the schedule is applied only to the preparation step that the application
has decided is safe to repeat. The external charge is a separate step. If that
charge returns an ambiguous failure, the program should surface the ambiguity,
record it, reconcile it, or hand it to a domain-specific safety mechanism
rather than blindly running the same one-way action again.

For non-idempotent work, first ask whether another attempt is semantically the
same operation or a new business action. If it is a new business action, a
retry schedule is the wrong boundary even when the failure looks transient.

## Notes and caveats

`Effect.retry` retries typed failures from the error channel according to the
provided policy. It does not inspect the external system to determine whether a
side effect already happened.

`Schedule.recurs(n)` limits the number of retries after the original attempt.
It is useful for bounding operational cost, but it is not a duplicate-safety
mechanism.

Timeouts are especially ambiguous for writes. A timeout can mean "the service
did not receive the request," "the service committed the request but the
response was lost," or "the service is still processing the request."

Do not treat this as advice to never retry writes. Some writes are safe because
the operation is naturally idempotent, transactional, or protected by a
protocol-level duplicate check. The important point is that the safety comes
from the operation boundary, not from `Schedule` itself.
