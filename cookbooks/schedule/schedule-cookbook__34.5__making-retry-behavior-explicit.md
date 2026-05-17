---
book: Effect `Schedule` Cookbook
section_number: "34.5"
section_title: "Making retry behavior explicit"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.5 Making retry behavior explicit

Retry behavior belongs in named `Schedule` values so traffic, wait time, and
retry budgets are reviewable at the policy boundary.

## Problem

You need retry behavior that can be reviewed without reading a loop body or
reverse-engineering a chain of anonymous schedule operators.

The first execution still happens normally. The schedule describes only the
follow-up decisions after that first failure: whether another retry is allowed
and how long to wait before it runs.

## When to use it

Use this when retry behavior is part of the contract for a service boundary,
queue consumer, startup check, or background worker. It is especially useful
when values may be tuned during incidents or reviewed in a pull request.

Good candidates include transient network failures, rate-limited dependency
calls, reconnect loops, and startup checks where retrying is expected but must
remain bounded.

## When not to use it

Do not use a retry schedule to make permanent errors look transient. Validation
failures, malformed requests, invalid credentials, and unsafe non-idempotent
writes should be classified before retry is applied.

Also avoid helpers named only `withRetry`. If retry behavior matters, the helper
or local schedule should say what it promises: `retryFiveTimesWithBackoff`,
`retryWithinStartupBudget`, or `retryWithJitteredBackoff`.

## Schedule shape

Build the policy out of small named pieces: one for cadence, one for count, and
one for elapsed budget when latency matters. `Schedule.both` gives intersection
semantics: all named pieces must continue, and the combined policy uses the
maximum delay chosen by those pieces.

With `Effect.retry`, `Schedule.recurs(5)` means up to five retries after the
original failed attempt, not five total attempts.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const retryCadence = Schedule.exponential("20 millis")
const retryLimit = Schedule.recurs(5)
const retryBudget = Schedule.during("250 millis")

const retryPolicy = retryCadence.pipe(
  Schedule.both(retryLimit),
  Schedule.both(retryBudget)
)

const callDownstream = Effect.fnUntraced(function*(
  attempts: Ref.Ref<number>
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`downstream attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail({ _tag: "Unavailable" } as const)
  }

  return "downstream-ok"
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const result = yield* callDownstream(attempts).pipe(
    Effect.retry(retryPolicy)
  )
  yield* Console.log(`result: ${result}`)
})

Effect.runPromise(program)
```

The names are deliberately plain. In code review, a change from
`Schedule.recurs(5)` to `Schedule.recurs(20)` appears as a change to
`retryLimit`, not as a small number buried inside an anonymous expression.

## Variants

For a short user-facing path, name a small fixed cadence and a low retry limit.
For many concurrent callers, name the jittered cadence separately so logs and
metrics are easier to interpret. For a two-phase policy, name the quick phase
and the slower phase before combining them with `Schedule.andThen`.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same schedule can therefore observe
different input depending on which combinator drives it.

Prefer names that describe behavior, not only implementation. `exponential`
says which constructor was used; `retryPaymentAuthorizationWithJitteredBackoff`
says what operational behavior the policy is supposed to provide.

Keep classification close to the effect being retried. The schedule should
describe recurrence mechanics: cadence, count, elapsed budget, jitter, phases,
and observation. It should not be responsible for deciding that a validation
error is secretly retryable.
