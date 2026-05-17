---
book: Effect `Schedule` Cookbook
section_number: "3.3"
section_title: "Add a delay between recurrences"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: true
---

# 3.3 Add a delay between recurrences

You have an effect that should run again, but not immediately. For example, a heartbeat
should wait between pulses, a polling loop should leave time for state to change, or a
retry should avoid hammering a dependency after a transient failure. This section keeps
the focus on Effect's `Schedule` model: recurrence is represented as data that decides
whether another decision point exists, which delay applies, and what output the policy
contributes. That framing makes later retry, repeat, and polling recipes easier to
compose without hiding timing behavior inside ad hoc loops.

## Problem

The recurrence needs pacing instead of a tight loop. The policy should insert
the same pause before each scheduled run.

The smallest fixed-delay building block is `Schedule.spaced(duration)`.

## When to use it

Use this when every recurrence should wait the same amount of time:

- Polling a resource every few seconds.
- Emitting a periodic heartbeat.
- Adding a simple pause between retry attempts.
- Turning a count-only example into a more realistic schedule.

## When not to use it

Do not use a fixed spacing when the delay should grow after repeated failures.
Backoff policies are a separate shape.

Do not use an unbounded spaced schedule accidentally. `Schedule.spaced("1 second")`
continues forever unless the repeated or retried effect stops for another
reason. Pair it with a limit when the workflow must be bounded.

Do not use spacing to make unsafe side effects safe. A repeated write still
needs idempotency or another clear duplicate-handling strategy.

## Schedule shape

`Schedule.spaced(duration)` creates a schedule that recurs continuously with the
specified spacing. With `Effect.repeat`, the effect still runs once immediately;
the schedule controls the recurrences after successful runs.

For a bounded repeat, limit the spaced schedule:

```ts
Schedule.spaced("1 second").pipe(Schedule.take(4))
```

This describes four scheduled recurrences after the initial run. The effect can
therefore run five times total.

For retry, the same schedule is driven by typed failures instead of successes.
Each failed attempt may be followed by the configured delay and another attempt,
until the schedule stops or an attempt succeeds.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const program = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.flatMap((run) => Console.log(`run ${run}`)),
    Effect.repeat(Schedule.spaced("1 second").pipe(Schedule.take(4)))
  )

  return yield* Ref.get(runs)
})

// The effect runs 5 times total:
// 1 initial run + 4 scheduled recurrences.
// There is a 1 second delay before each recurrence.
```

## Variants

If you already have a count schedule and want to add a fixed delay to each next
recurrence, use `Schedule.addDelay`:

```ts
import { Effect, Schedule } from "effect"

const policy = Schedule.addDelay(
  Schedule.recurs(4),
  () => Effect.succeed("1 second")
)
```

`Schedule.addDelay` adds the computed delay to the delay already chosen by the
base schedule. With `Schedule.recurs(4)`, the base schedule has no meaningful
pause, so this acts like adding a one-second wait between the four recurrences.

For retry, use the same schedule with `Effect.retry`:

```ts
import { Data, Effect, Schedule } from "effect"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly attempt: number
}> {}

let attempt = 0

const request = Effect.gen(function*() {
  attempt += 1

  if (attempt < 3) {
    return yield* Effect.fail(new RequestError({ attempt }))
  }

  return "ok"
})

const program = request.pipe(
  Effect.retry(Schedule.spaced("1 second").pipe(Schedule.take(2)))
)
```

This allows up to two retries, waiting one second before each retry.

## Notes and caveats

`Schedule.spaced` is already a recurrence schedule. It is not a sleep that runs
before the first execution. The first `repeat` or `retry` attempt happens
immediately.

When you pass a schedule directly to `Effect.repeat`, the returned value is the
schedule's final output, not the repeated effect's last value. With
`Schedule.spaced`, that output is the recurrence count.

`Schedule.addDelay` is effectful: the delay function returns an `Effect` that
produces a `Duration.Input`. If that effect can fail or require services, those
requirements become part of the schedule.
