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

Use `Schedule.spaced(duration)` when the next recurrence should wait for a
constant delay instead of running immediately.

## Problem

The effect should recur, but a tight loop would be too aggressive. Each
scheduled recurrence needs the same pause.

## When to use it

Use fixed spacing for simple pacing:

- Polling a resource every few milliseconds or seconds.
- Emitting a heartbeat.
- Adding a small delay between retry attempts.
- Making a count-only example closer to production behavior.

Do not use an unbounded spaced schedule accidentally. `Schedule.spaced("1 second")`
continues until another condition stops it, so pair it with a count, predicate,
or external interruption when the workflow must be finite.

## Schedule shape

`Schedule.spaced(duration)` keeps recurring and requests the same delay on each
step. With `Effect.repeat`, the first effect execution still happens
immediately; the delay applies before each later recurrence.

Limit a spaced schedule with `Schedule.take(n)`:

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const program = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.tap((run) => Console.log(`run ${run}`)),
    Effect.repeat(Schedule.spaced("25 millis").pipe(Schedule.take(3)))
  )

  const total = yield* Ref.get(runs)
  yield* Console.log(`total runs: ${total}`)
})

Effect.runPromise(program)
```

This runs four times total: one initial execution plus three spaced
recurrences.

## Retry example

The same schedule can pace retries. In retry, typed failures drive the schedule
instead of successful values.

```ts
import { Console, Data, Effect, Schedule } from "effect"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly attempt: number
}> {}

let attempt = 0

const request = Effect.gen(function*() {
  attempt += 1
  yield* Console.log(`attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail(new RequestError({ attempt }))
  }

  return "ok"
})

const program = request.pipe(
  Effect.retry(Schedule.spaced("25 millis").pipe(Schedule.take(2))),
  Effect.tap((value) => Console.log(`result: ${value}`))
)

Effect.runPromise(program)
```

Here the policy allows two retries and waits 25 milliseconds before each retry.

## Notes

`Schedule.spaced` is a schedule, not a sleep before the first attempt. The first
`repeat` or `retry` attempt is immediate.

Use `Schedule.addDelay` when you already have a schedule and want to add an
extra computed delay to whatever delay that schedule already chose. The delay
function returns an `Effect`, so any failure or service requirement from that
function becomes part of the schedule.
