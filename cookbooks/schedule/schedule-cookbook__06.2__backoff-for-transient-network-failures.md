---
book: Effect `Schedule` Cookbook
section_number: "6.2"
section_title: "Backoff for transient network failures"
part_title: "Part II — Core Retry Recipes"
chapter_title: "6. Retry with Exponential Backoff"
status: "draft"
code_included: true
---

# 6.2 Backoff for transient network failures

Network failures are often temporary, but repeated retry attempts should slow
down. Use exponential backoff with a finite retry budget and retry only the
typed failures that are plausibly transient.

## Problem

Remote calls can fail because of connection resets, timeouts, temporary DNS
failures, or gateway errors. Retrying immediately can turn a small transport
problem into extra load on both the service and the client.

## When to use it

Use this for idempotent network calls: reads, status checks, reconnects, and
writes protected by an idempotency key.

It is useful when the request itself is valid and the failure is about the
transport path or temporary gateway behavior. A timeout may succeed later; an
invalid request usually will not.

## When not to use it

Do not retry permanent request problems such as invalid input, authentication
failure, authorization failure, or response decoding failures.

Do not ignore server guidance. If an API returns `Retry-After` or explicit
rate-limit metadata, prefer a policy that honors it.

## Schedule shape

`Schedule.exponential("100 millis")` starts at 100 milliseconds and doubles
after each failed retry decision. `Schedule.recurs(5)` limits the policy to
five retries after the original attempt.

In the options form, `while` filters the typed error before spending another
retry. If the predicate returns `false`, `Effect.retry` fails with that error
immediately.

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class NetworkFailure extends Data.TaggedError("NetworkFailure")<{
  readonly reason: "ConnectionReset" | "Timeout" | "TemporaryDnsFailure"
}> {}

class HttpFailure extends Data.TaggedError("HttpFailure")<{
  readonly status: number
}> {}

class DecodeFailure extends Data.TaggedError("DecodeFailure")<{
  readonly message: string
}> {}

type FetchUserError = NetworkFailure | HttpFailure | DecodeFailure

const fetchUser = Effect.fnUntraced(function*(id: string, attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`network attempt ${attempt}`)

  if (attempt === 1) {
    return yield* Effect.fail(new NetworkFailure({ reason: "Timeout" }))
  }
  if (attempt === 2) {
    return yield* Effect.fail(new HttpFailure({ status: 502 }))
  }

  return { id, name: "Ada" }
})

const isRetryableNetworkFailure = (error: FetchUserError): boolean => {
  switch (error._tag) {
    case "NetworkFailure":
      return true
    case "HttpFailure":
      return error.status === 408 || error.status === 502 || error.status === 504
    case "DecodeFailure":
      return false
  }
}

const networkBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* fetchUser("user-123", attempts).pipe(
    Effect.retry({
      schedule: networkBackoff,
      while: isRetryableNetworkFailure
    }),
    Effect.forkScoped
  )

  yield* TestClock.adjust("100 millis")
  yield* TestClock.adjust("200 millis")

  const user = yield* Fiber.join(fiber)
  yield* Console.log(`loaded user: ${user.name}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The first failure is a timeout, the second is a retryable gateway failure, and
the third attempt succeeds. A `DecodeFailure` would stop immediately because
the predicate returns `false`.

## Notes

The first request is not delayed. Backoff begins only after the effect fails
with a typed error.

`Schedule.exponential` is unbounded by itself. Pair it with `Schedule.recurs`,
`times`, a deadline, or another stopping condition unless unbounded retry is
intentional.

For many concurrent callers, add jitter later so callers do not all retry on
the same exponential intervals.
