---
book: Effect `Schedule` Cookbook
section_number: "3.4"
section_title: "Stop after a limit"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: true
---

# 3.4 Stop after a limit

You have a recurrence policy that needs an explicit upper bound. The bound might be the
whole policy, such as "try three more times", or it might cap another policy, such as
"poll every second, but only twice more". This section keeps the focus on Effect's
`Schedule` model: recurrence is represented as data that decides whether another
decision point exists, which delay applies, and what output the policy contributes. That
framing makes later retry, repeat, and polling recipes easier to compose without hiding
timing behavior inside ad hoc loops.

## Problem

The recurrence must have a clear stopping rule. Sometimes the limit is the
whole policy; other times it caps an existing cadence, delay, or output shape.

The small building blocks are:

- `Schedule.recurs(n)` for a count-only policy.
- `Schedule.take(n)` for limiting another schedule to at most `n` outputs.
- `Schedule.during(duration)` for an elapsed-time recurrence window.

Each of these limits scheduled recurrences. The original effect still runs once
before `Effect.repeat` or `Effect.retry` asks the schedule whether another run is
allowed.

## When to use it

Use a limit whenever an otherwise valid recurrence must not continue forever:

- A retry budget for a transient typed failure.
- A finite number of successful repeats for sampling, probing, or tests.
- A cap on an unbounded cadence such as `Schedule.spaced("1 second")`.
- A best-effort time window, where recurrence should stop after elapsed time.

Use `Schedule.recurs(n)` when the count is the policy. Use `Schedule.take(n)`
when another schedule already describes the cadence, delay, or output and only
needs a cap.

## When not to use it

Do not use a limit to express a value-based stopping condition. If the decision
depends on a successful value, use `Effect.repeat` options such as `until` or
`while`. If it depends on a typed failure, use the corresponding `Effect.retry`
options.

Do not use `Schedule.during` as a hard timeout. A schedule is consulted at
recurrence boundaries; it does not interrupt an effect that is currently running.

Do not add a schedule when the effect should run exactly once. A plain effect
already has that behavior.

## Schedule shape

`Effect.repeat` and `Effect.retry` run the effect once before the schedule is
stepped.

For `Effect.repeat`, each successful value drives the schedule. If the effect
fails, repetition stops with that failure.

For `Effect.retry`, each typed failure drives the schedule. If a later attempt
succeeds, retrying stops with the successful value. If the schedule is exhausted
while the effect is still failing, the last typed failure is returned.

The count is therefore "how many scheduled recurrences are allowed after the
initial run":

| Limit                             | Meaning                                |
| --------------------------------- | -------------------------------------- |
| `Schedule.recurs(0)`              | No additional recurrences              |
| `Schedule.recurs(3)`              | At most three additional recurrences   |
| `schedule.pipe(Schedule.take(3))` | At most three outputs from `schedule`  |
| `Schedule.during("30 seconds")`   | Recur while the elapsed window is open |

With repeat, "three additional recurrences" can mean four total successful
executions. With retry, it can mean one initial attempt plus three retries.

## Code

Use `Schedule.recurs` when the count is the whole policy:

```ts
import { Effect, Ref, Schedule } from "effect"

const repeatThreeTimesTotal = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.update(runs, (n) => n + 1).pipe(
    Effect.repeat(Schedule.recurs(2))
  )

  return yield* Ref.get(runs)
})

// The effect runs 3 times total:
// 1 initial run + 2 scheduled recurrences.
```

Use `Schedule.take` when you already have a schedule and want to stop after a
fixed number of its recurrences:

```ts
import { Effect, Ref, Schedule } from "effect"

const pollThreeTimesTotal = Effect.gen(function*() {
  const polls = yield* Ref.make(0)

  yield* Ref.update(polls, (n) => n + 1).pipe(
    Effect.repeat(Schedule.spaced("1 second").pipe(Schedule.take(2)))
  )

  return yield* Ref.get(polls)
})

// The first poll happens immediately.
// The two scheduled recurrences are spaced by 1 second.
```

## Variants

The same limit can drive retry instead of repeat:

```ts
import { Data, Effect, Schedule } from "effect"

class TemporaryError extends Data.TaggedError("TemporaryError")<{
  readonly message: string
}> {}

declare const callService: Effect.Effect<string, TemporaryError>

const callWithThreeRetries = callService.pipe(
  Effect.retry(Schedule.recurs(3))
)
```

Here `callService` can run at most four times: the initial attempt plus three
retries. If the fourth attempt still fails, the last `TemporaryError` is
returned.

Use `Schedule.during` for an elapsed recurrence window:

```ts
import { Console, Effect, Schedule } from "effect"

const repeatDuringWindow = Console.log("tick").pipe(
  Effect.repeat(Schedule.during("5 seconds"))
)
```

`Schedule.during` is only the stopping window. By itself it does not add spacing,
so a fast effect can recur quickly until the window closes.

## Notes and caveats

`Schedule.recurs(n)` outputs a zero-based recurrence count. When passed directly
to `Effect.repeat`, the repeated program succeeds with the final schedule output,
not with the repeated effect's value.

`Schedule.take(n)` preserves the output type of the schedule it limits. Use it
when the original schedule output is still the useful one and you only need to
cap how many outputs are taken.

The off-by-one rule is the main caveat: external requirements often count total
executions, but schedule limits count recurrences after the first execution. If a
requirement says "try three times total", use a limit of `2`.

`Schedule.during(duration)` measures the elapsed recurrence window. It is useful
for best-effort loops, but not for interrupting a slow attempt. Use timeout
operators around the effect itself when an individual run needs a deadline.
