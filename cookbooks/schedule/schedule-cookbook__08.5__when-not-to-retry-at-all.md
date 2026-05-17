---
book: "Effect `Schedule` Cookbook"
section_number: "8.5"
section_title: "When not to retry at all"
part_title: "Part II — Retry Recipes"
chapter_title: "8. Idempotency and Retry Safety"
status: "draft"
code_included: true
---

# 8.5 When not to retry at all

Sometimes the correct retry policy is no retry. Use that policy when another
attempt would be a new business action, when the failure is permanent, or when
the next step is reconciliation rather than repetition.

## The anti-pattern

Some operations should not receive a retry policy at all. The anti-pattern is
to attach a reasonable-looking `Schedule` to an effect only because the failure
looks temporary:

```ts
import { Console, Effect, Schedule } from "effect"

let attempts = 0
let providerCharges = 0

const chargeCardOnce = Effect.gen(function*() {
  attempts += 1
  providerCharges += 1
  yield* Console.log(`charge attempt ${attempts}; provider charge ${providerCharges}`)

  if (attempts === 1) {
    return yield* Effect.fail("response-lost")
  }
})

const retryTransientFailure = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

// Unsafe: do not attach a generic retry policy to a one-way charge.
const unsafeProgram = chargeCardOnce.pipe(
  Effect.retry(retryTransientFailure),
  Effect.tap(() => Console.log(`provider charges: ${providerCharges}`))
)

Effect.runPromise(unsafeProgram)
```

The schedule is finite and delayed, but that does not make the operation safe.
If the charge was accepted and the response was lost, retrying can create a new
business action.

## Why it happens

Retries are often added near the transport boundary. A timeout, connection reset,
or `503` response feels like infrastructure noise, so it is tempting to reuse
the same schedule that works well for reads or duplicate-safe writes.

That reasoning skips the domain question: what happens if the operation already
partly or fully happened?

For unsafe writes, the caller may not know whether the remote system committed
the side effect. `Schedule` can decide when to try again, how long to wait, and
when to stop. It cannot decide whether another attempt is the same logical
operation or a second business event.

Permanent failures are another common source of accidental retries. Validation
errors, malformed requests, authorization failures, missing prerequisites, and
business-rule rejections usually require a different input, different caller
permissions, or an operator fix. Waiting does not change those facts.

## Why it is risky

Retrying the wrong operation converts one failure into several possible
failures. A payment may be charged twice. A shipment may be created twice. An
email or webhook may be delivered multiple times. A state transition may advance
farther than the caller intended.

It also hides the information the caller needs. If a request is invalid, the
caller should correct it. If credentials are wrong, the caller should
reauthenticate or escalate. If a write has an unknown outcome, the system should
record that ambiguity and reconcile it instead of pretending another attempt is
automatically harmless.

A retry limit only bounds the number of additional attempts. It does not make an
unsafe operation safe:

```ts
import { Console, Effect, Schedule } from "effect"

const boundedButStillUnsafe = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(1))
)

const program = Console.log(`bounded policy: ${Schedule.isSchedule(boundedButStillUnsafe)}`)

Effect.runPromise(program)
```

This policy allows only one retry after the original attempt, but that one retry
may still be one duplicate too many.

## A better approach

Do not attach `Effect.retry` when the next correct action is correction,
escalation, or reconciliation.

```ts
import { Console, Effect, Result } from "effect"

let providerCharges = 0

const submitPaymentOnce = Effect.gen(function*() {
  providerCharges += 1
  yield* Console.log(`submitted payment once; provider charge ${providerCharges}`)
  return yield* Effect.fail("unknown-payment-outcome")
})

const recordForReconciliation = (error: unknown) =>
  Console.log(`recorded for reconciliation: ${String(error)}`)

const program = Effect.gen(function*() {
  const result = yield* Effect.result(submitPaymentOnce)

  if (Result.isFailure(result)) {
    return yield* recordForReconciliation(result.failure)
  }

  yield* Console.log("payment confirmed")
})

Effect.runPromise(program)
```

This program intentionally has no retry schedule around `submitPaymentOnce`. A
failure is treated as an outcome to record and resolve through a safer path.
That path might query the downstream system, notify an operator, expose an
"unknown" status to the caller, or hand the case to a reconciliation worker.

Use the same shape for permanent errors. Return validation failures to the
caller. Surface authorization failures to the authentication or permission
layer. Send malformed upstream responses to monitoring. Route irrecoverable
infrastructure failures to an operational fallback. In each case, the important
choice is to avoid spending retry attempts on work that cannot become correct by
waiting.

## Notes and caveats

No retry policy is still a policy. It says the operation should be attempted
once and then handled by the domain-specific failure path.

Avoid retrying when the operation is a non-idempotent write, when the failure is
permanent, when success requires the caller to change the request, or when the
correct next step is human or automated reconciliation.

This does not mean every write must fail fast forever. Some writes are safe to
retry because they are explicitly duplicate-safe. That safety belongs to the
operation boundary, not to `Schedule`.

If only part of a workflow is retryable, put the schedule around that smallest
safe part. Do not wrap the whole workflow just because one internal call may
benefit from retry.

When in doubt, ask what a second attempt means in the business domain. If it
means "try the same logical operation again," a bounded schedule may be
appropriate. If it means "perform another business action," do not retry at that
boundary.
