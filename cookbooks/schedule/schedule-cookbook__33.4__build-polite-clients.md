---
book: Effect `Schedule` Cookbook
section_number: "33.4"
section_title: "Build polite clients"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "33. Respect Rate Limits"
status: "draft"
code_included: true
---

# 33.4 Build polite clients

External dependencies are shared systems. A polite client makes retry spacing,
caps, jitter, and safety assumptions visible in the `Schedule` value.

## Problem

An external API can fail transiently with timeouts, overload, or rate-limit
responses. Immediate retries increase pressure on the dependency, but no retry
at all can make the client brittle. The policy should space follow-up attempts,
stop after a clear cap, and avoid synchronized retries across many instances.

The first call still happens normally. The schedule controls only what happens
after a retryable failure.

## When to use it

Use this for idempotent reads, status checks, reconnects, and writes protected
by an idempotency key. It is especially useful when many processes may call the
same dependency, because the schedule documents both per-client behavior and
aggregate pressure.

A useful polite-client policy answers four questions: how long to wait between
retries, how many retries are allowed, whether callers are desynchronized with
jitter, and whether the operation is safe to perform more than once.

## When not to use it

Do not use a schedule to make an unsafe operation appear safe. Retrying a
non-idempotent write can create duplicate payments, emails, orders, or repeated
mutations. Add an idempotency key, use a status lookup, or move the work behind a
queue before applying retry.

Also avoid this recipe for validation errors, malformed requests, permission
failures, and other permanent failures. Classify those before `Effect.retry`.

## Schedule shape

A practical default is exponential backoff, a retry cap, and jitter:
`Schedule.exponential(base)`, `Schedule.recurs(n)`, `Schedule.both`, then
`Schedule.jittered`.

Use `Schedule.spaced` instead of exponential backoff when the dependency asks
for a steady cadence. Use `Schedule.during` when elapsed time matters more than
attempt count.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

type ClientError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "RateLimited" }
  | { readonly _tag: "Rejected"; readonly reason: string }

const isRetryable = (error: ClientError): boolean =>
  error._tag !== "Rejected"

const politeReadRetryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(3)),
  Schedule.jittered
)

const politeWriteRetryPolicy = Schedule.exponential("30 millis").pipe(
  Schedule.both(Schedule.recurs(2)),
  Schedule.jittered
)

const fetchAccount = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`read attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail({ _tag: "Unavailable" } as const)
  }

  return "account-123"
})

const createCharge = Effect.fnUntraced(function*(
  attempts: Ref.Ref<number>,
  idempotencyKey: string
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`write attempt ${attempt} with ${idempotencyKey}`)

  if (attempt === 1) {
    return yield* Effect.fail({ _tag: "Timeout" } as const)
  }

  return `charge-for-${idempotencyKey}`
})

const program = Effect.gen(function*() {
  const readAttempts = yield* Ref.make(0)
  const writeAttempts = yield* Ref.make(0)

  const account = yield* fetchAccount(readAttempts).pipe(
    Effect.retry({
      schedule: politeReadRetryPolicy,
      while: isRetryable
    })
  )

  const charge = yield* createCharge(writeAttempts, "charge-key-1").pipe(
    Effect.retry({
      schedule: politeWriteRetryPolicy,
      while: isRetryable
    })
  )

  yield* Console.log(`done: ${account}, ${charge}`)
})

Effect.runPromise(program)
```

The read uses jittered exponential backoff and a small retry cap. The write uses
the same idea, but the idempotency key is part of the operation before retry is
attached.

## Variants

For user-facing calls, keep the cap small so callers receive a clear answer
quickly. For background work, prefer longer base delays and stronger aggregate
budgets. For APIs that publish explicit reset times, derive the delay from the
response metadata instead of guessing.

For steady polling, use `Schedule.spaced(duration)` and add jitter only when the
provider contract allows approximate spacing.

## Notes and caveats

`Effect.retry` feeds failures into the schedule, so classify errors before
retrying. A timeout, `503`, or rate-limit response may be retryable; a `400` or
authorization failure usually is not.

Jitter reduces synchronized load, but it also makes exact timing less
predictable in logs and tests. Keep the base policy understandable before adding
jitter.

The schedule controls recurrence. It does not provide rate limiting across
processes, enforce provider quotas, or make side effects idempotent.
