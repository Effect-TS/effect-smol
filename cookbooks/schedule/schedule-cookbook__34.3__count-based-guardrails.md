---
book: Effect `Schedule` Cookbook
section_number: "34.3"
section_title: "Count-based guardrails"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.3 Count-based guardrails

Count limits are operational guardrails for retry, repeat, and polling policies
when the real completion condition may never arrive.

## Problem

A recurrence policy should answer three questions without requiring a reader to
inspect the loop body: how long the workflow waits between attempts, how many
follow-up attempts are allowed, and what happens when the count is exhausted.

Put the count at the schedule boundary instead of hiding it in a mutable counter
or a hand-written recursive function.

## When to use it

Use a count guard when the number of follow-up executions is itself an
operational requirement. A user-facing request may allow only a few retries
before returning the last error; a background worker may allow more attempts but
still needs a bound.

It is also useful as a secondary limit on a richer timing policy. Backoff,
spacing, and jitter describe when to try again. `Schedule.recurs` describes how
many more chances the workflow gets.

## When not to use it

Do not use a count limit as a latency budget. Three retries can finish quickly
when failures are immediate, or take a long time when each attempt waits on a
slow dependency before failing. If the requirement is "try for no more than 10
seconds", use a time budget such as `Schedule.during`.

Do not use retries to hide permanent failures. Bad input, invalid credentials,
authorization failures, and unsafe non-idempotent writes should be classified
before retry is applied.

## Schedule shape

Start with the cadence, then add the count guard with `Schedule.both`. The
combined schedule continues only while both sides continue, so it stops when the
count is exhausted. The count is a recurrence count, not a total execution
count: `Schedule.recurs(5)` means five follow-up executions.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const retryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const repeatPolicy = Schedule.spaced("15 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)

const callDownstream = Effect.fnUntraced(function*(
  attempts: Ref.Ref<number>
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`service attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail({ _tag: "Timeout" } as const)
  }

  return "service-ok"
})

const refreshOneBatch = Effect.fnUntraced(function*(
  batches: Ref.Ref<number>
) {
  const batch = yield* Ref.updateAndGet(batches, (n) => n + 1)
  yield* Console.log(`refresh batch ${batch}`)
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const batches = yield* Ref.make(0)

  const result = yield* callDownstream(attempts).pipe(
    Effect.retry(retryPolicy)
  )
  yield* Console.log(`retry result: ${result}`)

  yield* refreshOneBatch(batches).pipe(
    Effect.repeat(repeatPolicy)
  )
  yield* Console.log("bounded refresh done")
})

Effect.runPromise(program)
```

The retry policy allows the original call plus at most three retries. The repeat
policy runs the first refresh immediately, then allows at most two more refresh
batches.

## Variants

For service-boundary retries, a count is often only one guardrail. Add elapsed
time when callers care about the retry window, for example by combining the
policy with `Schedule.during(duration)`.

For polling, pair the count with a predicate over successful values. The
predicate handles the domain condition; the count protects against waiting
forever.

## Notes and caveats

`Schedule.recurs(n)` returns a `Schedule<number>`. Its output is the zero-based
recurrence count. Most retry and repeat programs ignore that output, but it can
be useful for logging with `Schedule.tapOutput`.

`Effect.retry` feeds typed failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same count guard limits different
events depending on which combinator drives it.

The most common mistake is off by one. If a requirement says "try the operation
three times total", the retry guard is `Schedule.recurs(2)`, not
`Schedule.recurs(3)`.
