---
book: "Effect `Schedule` Cookbook"
section_number: "5.1"
section_title: "Basic exponential backoff"
part_title: "Part II — Retry Recipes"
chapter_title: "5. Exponential and Capped Backoff"
status: "draft"
code_included: true
---

# 5.1 Basic exponential backoff

`Schedule.exponential(base)` starts with `base` as the first retry delay and
multiplies later delays by the factor, which defaults to `2`.

## Problem

A dependency may be unhealthy long enough that fixed-delay retries keep adding
pressure. You want early recovery to be quick, but repeated failures should
make the caller slow down.

## When to use it

Use exponential backoff for idempotent operations whose failures are probably
temporary: network calls, brief service unavailability, short database
failovers, or dependency probes.

It is a better remote-call default than a tight loop because each failed retry
decision increases the pause before the next attempt.

## When not to use it

Do not use backoff for operations that are unsafe to run more than once.
Retried writes need idempotency, deduplication, transactions, or another
domain-specific guarantee.

Do not leave the schedule unbounded unless retrying forever is intentional and
the fiber is supervised. Basic exponential backoff also has no jitter, so many
callers that fail together can still retry together.

## Schedule shape

`Schedule.exponential("100 millis")` produces these retry delays with the
default factor:

- first retry: 100 milliseconds
- second retry: 200 milliseconds
- third retry: 400 milliseconds
- fourth retry: 800 milliseconds

With `Effect.retry`, the original attempt is immediate. The schedule is
consulted only after a typed failure. Pair it with `Schedule.recurs(5)` or
`times: 5` when the caller needs a final failure after five retries.

## Example

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly attempt: number
}> {}

const fetchUser = Effect.fnUntraced(function*(id: string, attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`fetch user attempt ${attempt}`)

  if (attempt < 4) {
    return yield* Effect.fail(new RequestError({ attempt }))
  }

  return { id, name: "Ada" }
})

const retryWithBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* fetchUser("user-123", attempts).pipe(
    Effect.retry(retryWithBackoff),
    Effect.forkScoped
  )

  yield* TestClock.adjust("100 millis")
  yield* TestClock.adjust("200 millis")
  yield* TestClock.adjust("400 millis")

  const user = yield* Fiber.join(fiber)
  yield* Console.log(`loaded user: ${user.name}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The example fails three times, then succeeds on the fourth attempt. The virtual
clock advances through the 100, 200, and 400 millisecond backoff delays, so the
snippet terminates immediately.

## Notes

The first execution is not delayed. Backoff begins only after the effect fails
with a typed error.

`Schedule.recurs(5)` means five retries after the original attempt, so the
effect can run up to six times.

`Schedule.exponential` outputs the current delay. After `Schedule.both`, the
combined output is a tuple of the exponential delay and the recurrence count.
Plain `Effect.retry` uses that output for scheduling and returns the successful
value of the retried effect.
