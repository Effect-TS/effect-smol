---
book: "Effect `Schedule` Cookbook"
section_number: "8.2"
section_title: "Retrying idempotent writes"
part_title: "Part II — Retry Recipes"
chapter_title: "8. Idempotency and Retry Safety"
status: "draft"
code_included: true
---

# 8.2 Retrying idempotent writes

An idempotent write is a write where repeating the same request has the same
effect as running it once. This recipe places `Schedule` around that
duplicate-safe boundary.

## Problem

Ambiguous write failures are dangerous because the caller may see a timeout,
dropped connection, or temporary service error after the remote system has
already applied the change. Retrying an ordinary write can create a duplicate
charge, send a second notification, insert a second row, or publish the same
command twice.

Retry the write only when the operation is designed to be duplicate-safe. Then
use `Schedule` to make the retry policy finite, delayed, and visible.

The schedule is not the safety mechanism. It only says when to try again. The
write contract must make repeated attempts equivalent to one logical write.

## When to use it

Use this recipe when the write is explicitly idempotent or duplicate-safe. Good
examples include setting a resource to a known value, upserting by a stable
identifier, acknowledging a message with broker-level deduplication, or writing
to an endpoint that treats repeated equivalent requests as the same logical
operation.

It also fits writes where the downstream system documents that a retry after a
transport failure is safe. In those cases, the schedule handles transient timing
problems while the protocol handles duplicate attempts.

Keep the retry around the smallest duplicate-safe write. If a workflow contains
reads, validation, and one idempotent write, retry the write effect itself.

## When not to use it

Do not use retries to make non-idempotent writes safe. If repeating the operation
can create additional business effects, add a domain-level safety mechanism
before adding a schedule.

Do not retry ambiguous writes that depend on hidden server state unless the
server gives a documented duplicate-safe contract. A finite retry limit reduces
damage, but it does not change the semantics of the write.

Do not retry validation failures, authorization failures, malformed payloads, or
business-rule rejections. Those errors are usually permanent and should be
returned immediately.

## Schedule shape

For duplicate-safe writes, prefer a bounded policy with backoff and jitter. The
example uses short demo delays; production values are usually larger.
`Schedule.exponential` spaces retries farther apart after repeated failures.
`Schedule.jittered` spreads concurrent callers around each computed delay.
`Schedule.recurs(4)` limits the policy to at most four retries after the original
attempt.

With `Effect.retry`, the write runs once immediately. If it fails with a typed
error, that error is fed to the schedule. The schedule decides whether another
attempt is allowed and how long to wait before that attempt. If all retries are
exhausted, `Effect.retry` returns the last typed failure.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class WriteTimeout extends Data.TaggedError("WriteTimeout")<{
  readonly operation: "SetAccountEmail"
}> {}

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly status: 503 | 504
}> {}

class InvalidEmail extends Data.TaggedError("InvalidEmail")<{
  readonly email: string
}> {}

type WriteError = WriteTimeout | ServiceUnavailable | InvalidEmail

let attempts = 0

const setAccountEmail = (
  accountId: string,
  email: string
): Effect.Effect<void, WriteError> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`set email attempt ${attempts} for ${accountId}`)

    if (!email.includes("@")) {
      return yield* Effect.fail(new InvalidEmail({ email }))
    }

    if (attempts < 3) {
      return yield* Effect.fail(new WriteTimeout({ operation: "SetAccountEmail" }))
    }

    yield* Console.log(`stored ${email}`)
  })

const retryDuplicateSafeWrite = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const updateEmail = (accountId: string, email: string) =>
  setAccountEmail(accountId, email).pipe(
    Effect.retry({
      schedule: retryDuplicateSafeWrite,
      while: (error) => error._tag === "WriteTimeout" || error._tag === "ServiceUnavailable"
    })
  )

const program = updateEmail("account-1", "ada@example.com")

Effect.runPromise(program)
```

This example assumes `setAccountEmail(accountId, email)` is duplicate-safe:
running it more than once sets the same account to the same email address. A
timeout or temporary service failure can be retried. An `InvalidEmail` failure is
not retried because repeating the same invalid write will not make it valid.

## Variants

Use a fixed delay when the downstream system prefers steady retry traffic, or a
larger background policy when the caller can tolerate more latency:

```ts
import { Console, Effect, Schedule } from "effect"

const steadyWriteRetry = Schedule.spaced("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const backgroundWriteRetry = Schedule.exponential("20 millis", 2).pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

let attempts = 0

const writeAuditMarker = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`audit marker attempt ${attempts}`)
  if (attempts < 2) return yield* Effect.fail("service-unavailable")
  return "stored"
})

const program = Effect.gen(function*() {
  const result = yield* writeAuditMarker.pipe(Effect.retry(steadyWriteRetry))
  yield* Console.log(`steady policy result: ${result}`)
  yield* Console.log(`background policy ready: ${Schedule.isSchedule(backgroundWriteRetry)}`)
})

Effect.runPromise(program)
```

The fixed schedule still limits retries and adds jitter, but avoids exponential
growth. The longer background schedule is a throughput and latency choice, not
an idempotency guarantee.

## Notes and caveats

Idempotency keys are one common way to make a write duplicate-safe, but they are
not the focus of this recipe. The important point here is the contract: repeated
attempts of the same logical write must not create additional business effects.

Retry only typed failures that plausibly mean the write outcome is unknown or
temporarily unavailable, such as timeouts, connection loss, rate limits, or 5xx
responses. Keep permanent failures out of the retry path with `while` or
`until`.

The first attempt is not delayed. The schedule controls only the waits between
failed attempts.

For user-facing writes, keep retry budgets small. If the operation may still be
running remotely after the caller gives up, expose a way to observe the final
state rather than asking the user to submit a second independent write.
