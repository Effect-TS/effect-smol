---
book: "Effect `Schedule` Cookbook"
section_number: "1.5"
section_title: "Composability as the core design idea"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: true
---

# 1.5 Composability as the core design idea

`Schedule` is designed around small policies that can be combined. A retry or
repeat policy often has several concerns: a cadence, a limit, a predicate,
observability, and sometimes phases. Each concern can be represented separately.

## Problem

When recurrence logic is written as one loop, the policy becomes hard to read.
You have to inspect control flow to answer basic questions: what is the delay,
what stops the loop, and what happens after the first phase?

Schedules make those relationships explicit.

## Core combinators

Choose the combinator by the relationship between policies:

- `Schedule.both` means both policies must continue. The combined delay is the
  maximum delay.
- `Schedule.either` means either policy may continue. The combined delay is the
  minimum delay.
- `Schedule.andThen` means the policies run sequentially: first one, then the
  other.

Use the output-selecting variants when a tuple is not useful:
`bothLeft`, `bothRight`, `bothWith`, `eitherLeft`, `eitherRight`, and
`eitherWith`.

## Example

This retry policy has three separate concerns: a fast phase, a slower phase, and
a hard retry limit.

```ts
import { Console, Data, Effect, Schedule } from "effect"

class TemporaryError extends Data.TaggedError("TemporaryError")<{
  readonly attempt: number
}> {}

const burstThenSlow = Schedule.spaced("10 millis").pipe(
  Schedule.take(2),
  Schedule.andThen(
    Schedule.spaced("25 millis").pipe(Schedule.take(2))
  )
)

const retryPolicy = burstThenSlow.pipe(
  Schedule.bothLeft(Schedule.recurs(4)),
  Schedule.tapOutput((step) => Console.log(`policy step ${step}`))
)

let attempts = 0

const request = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`request attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new TemporaryError({ attempt: attempts }))
  }

  return "ok"
})

const program = Effect.gen(function*() {
  const result = yield* request.pipe(
    Effect.retry(retryPolicy)
  )
  yield* Console.log(`result: ${result}`)
})

Effect.runPromise(program)
```

The timing policy is phased with `andThen`. The retry budget is added with
`bothLeft`, so both the timing policy and the count limit must allow another
retry.

## Common mistakes

Do not use `both` when the intended behavior is phased. `both` runs policies at
the same time and stops when either one stops. Use `andThen` for "do this first,
then switch to that."

Do not ignore output shape. `both` and `either` return tuples. That is useful
when both outputs matter, but noisy when the caller only needs one side or a
custom value.

Do not combine many policies before naming the smaller pieces. Names make the
relationship between delay, limits, predicates, and phases visible.

## Practical guidance

Build schedules in this order:

1. Start with the cadence or backoff.
2. Add the stopping policy.
3. Add input predicates if the policy should inspect successes or failures.
4. Add output mapping or tapping for observability.
5. Sequence phases with `andThen` only when the policy really changes over time.

The result should read as a recurrence policy, not as hidden control flow.
