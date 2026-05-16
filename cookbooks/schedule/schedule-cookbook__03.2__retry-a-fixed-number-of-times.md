---
book: Effect `Schedule` Cookbook
section_number: "3.2"
section_title: "Retry a fixed number of times"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: true
---

# 3.2 Retry a fixed number of times

You have an effect that can fail with a typed error, and a small number of immediate
retries is enough. For example, a request might race a short-lived service restart, a
connection pool might briefly have no available connection, or a cache refresh might
fail once before succeeding. This section keeps the focus on Effect's `Schedule` model:
recurrence is represented as data that decides whether another decision point exists,
which delay applies, and what output the policy contributes. That framing makes later
retry, repeat, and polling recipes easier to compose without hiding timing behavior
inside ad hoc loops.

## Problem

You have an effect that can fail with a typed error, and a small number of
immediate retries is enough. For example, a request might race a short-lived
service restart, a connection pool might briefly have no available connection,
or a cache refresh might fail once before succeeding.

The minimal schedule for this is `Schedule.recurs(n)`. It retries a failing
effect at most `n` times. The initial execution is not counted as a retry, so
`Schedule.recurs(3)` means one original attempt plus up to three more attempts.

## When to use it

Use this recipe when the retry budget is the whole policy. You want a clear
upper bound, no delay, and no special error filtering. It is a good first
building block for examples, tests, idempotent reads, and local operations where
retrying immediately is acceptable.

It is also useful as the count limit inside a larger policy. The source docs for
`Schedule.recurs` show it being combined with other schedules, and that is the
main reason to prefer it over an inline retry option when you expect the policy
to grow.

## When not to use it

Do not use an immediate fixed retry loop for operations that should back off
under load. HTTP calls, queue consumers, database reconnects, and rate-limited
APIs often need spacing, exponential backoff, jitter, or error-specific
conditions.

Do not use it for defects or fiber interruptions. `Effect.retry` retries typed
failures from the error channel. The `Effect.retry` source docs explicitly note
that defects and interruptions are not retried as typed failures.

Do not use it when exhaustion needs a fallback value or recovery effect. In that
case, use the retry policy with a recovery API such as `Effect.retryOrElse`.

## Schedule shape

`Schedule.recurs(times)` returns a `Schedule<number>`. The output is the
zero-based recurrence count, but `Effect.retry` normally ignores that output and
returns the successful value of the retried effect.

When used with `Effect.retry`, the schedule is driven by failures. Each typed
failure is offered to the schedule. If the schedule continues, the effect is run
again. If the schedule stops while the effect is still failing, `Effect.retry`
propagates the last typed failure.

The important counting rule is:

- `Schedule.recurs(0)` allows no retries.
- `Schedule.recurs(1)` allows one retry, for up to two executions total.
- `Schedule.recurs(3)` allows three retries, for up to four executions total.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly attempt: number
}> {}

let attempt = 0

const fetchUser = Effect.gen(function*() {
  attempt += 1

  if (attempt < 4) {
    return yield* Effect.fail(new RequestError({ attempt }))
  }

  return { id: "user-1", name: "Ada" }
})

const program = fetchUser.pipe(
  Effect.retry(Schedule.recurs(3))
)
```

Here `fetchUser` fails on attempts 1, 2, and 3, then succeeds on attempt 4. The
policy permits exactly those three retries, so `program` succeeds with the user
value. If the fourth attempt failed too, the retry schedule would be exhausted
and the last `RequestError` would be propagated.

## Variants

For the same count-only behavior, `Effect.retry` also accepts retry options:

```ts
const program = fetchUser.pipe(
  Effect.retry({ times: 3 })
)
```

That form is compact when the retry policy is local and unlikely to be reused.
Use `Schedule.recurs(3)` when you want to name the policy, pass it around, or
compose it later with another schedule.

You can also pass the effect as the first argument:

```ts
const program = Effect.retry(fetchUser, Schedule.recurs(3))
```

This is equivalent to the piped form. Choose the style that fits the surrounding
code.

## Notes and caveats

`Effect.retry` does nothing extra when the first attempt succeeds. The retry
tests in `Effect.test.ts` verify that a successful effect is evaluated once even
with a large retry count.

The retry count is not a total-attempt count. This is the most common off-by-one
mistake with `Schedule.recurs`. If an external system says "try this operation
three times total", use `Schedule.recurs(2)`.

Immediate retries can make a transient failure worse if the dependency is
already overloaded. Treat this recipe as the smallest useful policy. Once the
operation crosses a process or network boundary, add a delay policy before using
it in production.

Keep the retried operation safe to run more than once. Retrying a read is often
straightforward; retrying a write requires idempotency, deduplication, or a clear
understanding of the side effects that may have already happened.
