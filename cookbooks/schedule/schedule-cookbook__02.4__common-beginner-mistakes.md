---
book: Effect `Schedule` Cookbook
section_number: "2.4"
section_title: "Common beginner mistakes"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.4 Common beginner mistakes

This subsection explains Common beginner mistakes as a practical Effect `Schedule`
recipe. This section keeps the focus on Effect's `Schedule` model: recurrence is
represented as data that decides whether another decision point exists, which delay
applies, and what output the policy contributes. That framing makes later retry, repeat,
and polling recipes easier to compose without hiding timing behavior inside ad hoc
loops.

## What this section is about

This section collects the traps that usually appear when moving from a mental
model of "run this again" to Effect's more precise model:

- `Effect.repeat` schedules the success path.
- `Effect.retry` schedules the typed failure path.
- Count-based policies count recurrences after the first run.
- The direct schedule overload of `Effect.repeat` returns the schedule output.

The goal is not to memorize edge cases. The goal is to keep the success channel,
the error channel, and the schedule output separate while reading or writing a
policy.

## Why it matters

The wrong operator can silently change the meaning of a program. A failing
operation wrapped with `repeat` is not retried. A successful polling effect
wrapped with `retry` is not repeated. A count that was meant as "three total
tries" can become "one initial try plus three more".

These mistakes also affect types. `Effect.retry` succeeds with the successful
value of the original effect, but `Effect.repeat` with a raw `Schedule` succeeds
with the schedule's output. With `Schedule.recurs(3)`, that output is a number,
not the repeated effect's success value.

## Core idea

Ask what event should trigger another run:

| Question                                                                | Use                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The effect succeeded, and that success should lead to another run       | `Effect.repeat`                                                                |
| The effect failed with a typed error, and that failure may be transient | `Effect.retry`                                                                 |
| The effect succeeded, and you want to stop from the successful value    | `Effect.repeat({ until: predicate })` or `Effect.repeat({ while: predicate })` |
| The effect failed, and you want to stop from the error value            | `Effect.retry({ until: predicate })` or `Effect.retry({ while: predicate })`   |

The schedule is the recurrence policy. It is not the first execution. The first
execution happens before `repeat` or `retry` can consult the schedule.

## Common mistakes

### Using `repeat` for a failing operation

`repeat` does not recover from failure. If the effect fails, repetition stops and
the failure is propagated.

```ts
import { Effect, Schedule } from "effect"

const request = Effect.fail("temporary outage")

const program = request.pipe(
  Effect.repeat(Schedule.recurs(3))
)
```

This program does not make four requests. It makes one request and fails. Use
`retry` when the thing you want to schedule is the error path:

```ts
const program = request.pipe(
  Effect.retry(Schedule.recurs(3))
)
```

If `request` keeps failing, this can make the initial attempt plus up to three
retries.

### Using `retry` for a successful polling loop

`retry` does nothing after success. Once the effect succeeds, the returned effect
succeeds immediately with that value.

```ts
import { Effect } from "effect"

let count = 0

const program = Effect.sync(() => count++).pipe(
  Effect.retry({ times: 100 })
)
```

The effect above runs once because there is no failure to retry. Use `repeat`
for polling, heartbeats, refresh loops, or any workflow where a successful result
should lead to another run.

### Counting `times` as total executions

Both `repeat` and `retry` perform the first run before the schedule can decide
whether another run should happen.

```ts
import { Effect } from "effect"

let repeated = 0

const repeatProgram = Effect.sync(() => ++repeated).pipe(
  Effect.repeat({ times: 2 })
)

let retried = 0

const retryProgram = Effect.failSync(() => ++retried).pipe(
  Effect.retry({ times: 2 })
)
```

`repeatProgram` can run three times: the initial run plus two repetitions.
`retryProgram` can fail three times: the initial attempt plus two retries.

The same rule applies to `Schedule.recurs(n)` when it is used with `repeat` or
`retry`: `n` is a bound on recurrences after the first execution, not the total
number of executions.

### Expecting a raw schedule repeat to return the effect value

The raw `Schedule` overload of `Effect.repeat` returns the schedule's final
output.

```ts
import { Effect, Schedule } from "effect"

const program = Effect.succeed("done").pipe(
  Effect.repeat(Schedule.recurs(3))
)
```

The result type is based on the schedule output. For `Schedule.recurs(3)`, that
output is a number.

If the value you want is the last successful value from the effect, use the
options form:

```ts
const program = Effect.succeed("done").pipe(
  Effect.repeat({
    schedule: Schedule.recurs(3)
  })
)
```

This form keeps the repeated effect's success value as the success value of the
whole program.

### Putting the predicate on the wrong value

The predicates in `repeat` options inspect successful values. The predicates in
`retry` options inspect errors.

```ts
import { Effect } from "effect"

const repeatUntilDone = Effect.succeed("done").pipe(
  Effect.repeat({
    until: (value) => value === "done"
  })
)

const retryWhileTemporary = Effect.fail("temporary").pipe(
  Effect.retry({
    while: (error) => error === "temporary"
  })
)
```

Use `until` when the predicate describes the stopping condition. Use `while`
when the predicate describes the condition for continuing.

### Forgetting that some schedules are unbounded

Schedules such as `Schedule.spaced("1 second")` recur indefinitely. That is
useful for services that should run until interrupted, but it is usually not
what you want in a one-shot business operation.

```ts
import { Effect, Schedule } from "effect"

const heartbeat = Effect.void.pipe(
  Effect.repeat(Schedule.spaced("1 second"))
)
```

That loop stops only if the effect fails or the fiber is interrupted. When you
need a bounded policy, combine the timing schedule with an explicit bound such
as `Schedule.recurs`.

## Practical guidance

Use this checklist before choosing the operator:

| If you mean...                                 | Prefer...                                                   |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Try again after a typed failure                | `Effect.retry`                                              |
| Run again after a success                      | `Effect.repeat`                                             |
| Keep the last successful value from repetition | `Effect.repeat({ times })` or `Effect.repeat({ schedule })` |
| Use the schedule's output as the result        | `Effect.repeat(schedule)`                                   |
| Limit a retry or repeat to `n` more runs       | `Schedule.recurs(n)` or `{ times: n }`                      |

For an external requirement like "try three times total", subtract the initial
run from the recurrence count. That means `Schedule.recurs(2)`, not
`Schedule.recurs(3)`.
