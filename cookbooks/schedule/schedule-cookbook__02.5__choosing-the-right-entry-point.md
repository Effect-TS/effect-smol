---
book: "Effect `Schedule` Cookbook"
section_number: "2.5"
section_title: "Choosing the right entry point"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.5 Choosing the right entry point

Choose the entry point by the channel the policy must observe. Timing comes
after that choice.

## Problem

The same schedule value can often be passed to `Effect.repeat` or
`Effect.retry`, but the two operators feed it different inputs. A policy that
should inspect successful statuses belongs on `repeat`. A policy that should
inspect transient typed failures belongs on `retry`.

## Decision table

| Question                                     | Entry point     |
| -------------------------------------------- | --------------- |
| Should the policy inspect successful values? | `Effect.repeat` |
| Should another run follow a success?         | `Effect.repeat` |
| Should the first failure stop the loop?      | `Effect.repeat` |
| Should the policy inspect typed failures?    | `Effect.retry`  |
| Should another run follow a typed failure?   | `Effect.retry`  |
| Should the first success stop the loop?      | `Effect.retry`  |

## Schedule shape

Both entry points accept an options object, a `Schedule`, or a schedule builder.

Use the options form when the policy is local:

- `times` limits recurrences after the first execution.
- `while` continues while the observed value satisfies a predicate.
- `until` continues until the observed value satisfies a predicate.
- `schedule` adds an explicit schedule policy.

The observed value depends on the entry point. In `repeat`, `while` and `until`
inspect successful values. In `retry`, they inspect typed failures.

Use a named `Schedule` when the policy is reusable or composed from several
concerns. Use the builder form when the schedule needs to inspect its input and
you want that input type inferred from the effect.

Return values are different. `Effect.retry` succeeds with the original effect's
successful value. The raw schedule overload of `Effect.repeat` succeeds with the
schedule output. The options form of `Effect.repeat` keeps the repeated effect's
final successful value.

## Code

This program uses both entry points for their intended channels:

```ts
import { Console, Data, Effect, Schedule } from "effect"

type Status = "starting" | "ready"

let statusChecks = 0

const readStatus = Effect.sync((): Status => {
  statusChecks += 1
  return statusChecks < 3 ? "starting" : "ready"
}).pipe(
  Effect.tap((status) => Console.log(`status check: ${status}`))
)

class ServiceError extends Data.TaggedError("ServiceError")<{
  readonly retryable: boolean
}> {}

let serviceCalls = 0

const callService = Effect.gen(function*() {
  serviceCalls += 1
  yield* Console.log(`service call ${serviceCalls}`)

  if (serviceCalls < 3) {
    return yield* Effect.fail(new ServiceError({ retryable: true }))
  }

  return "service response"
})

const retryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const program = Effect.gen(function*() {
  const finalStatus = yield* readStatus.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("10 millis"),
      until: (status) => status === "ready"
    })
  )
  yield* Console.log(`repeat returned: ${finalStatus}`)

  const response = yield* callService.pipe(
    Effect.retry({
      schedule: retryPolicy,
      while: (error) => error.retryable
    })
  )
  yield* Console.log(`retry returned: ${response}`)
})

Effect.runPromise(program)
```

`"starting"` is a successful state, so it drives `repeat`. `ServiceError` is a
typed failure, so it drives `retry`.

## When not to use each entry point

Do not choose `repeat` to recover from failures. It propagates the first failure
unless the repeated effect handles that failure itself.

Do not choose `retry` for ordinary successful states. If `"pending"` or
`"starting"` is a valid response, model it as a success and repeat until it
becomes terminal.

Do not use either operator to hide unsafe duplication. Keep the repeated or
retried effect scoped to work that is safe to run more than once.

## Practical guidance

Ask these questions in order:

1. Is the recurrence triggered by success or typed failure?
2. Should the policy inspect the successful value or the error value?
3. Is the first execution part of the external budget?
4. Should the caller receive the effect value or the schedule output?
5. What bound stops the recurrence if the predicate never changes?

When exhaustion needs recovery, use `Effect.repeatOrElse` for repeated effects
that fail before completion and `Effect.retryOrElse` for retries that exhaust
while the effect is still failing.
