---
book: "Effect `Schedule` Cookbook"
section_number: "20.7"
section_title: "When not to add jitter"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "20. Jitter Concepts and Tradeoffs"
status: "draft"
code_included: true
---

# 20.7 When not to add jitter

Jitter is useful for desynchronizing callers, but it is the wrong tool when exact
timing is part of the contract.

## Problem

Before applying `Schedule.jittered`, decide what readers may rely on: an exact
cadence, or an approximate cadence around a base delay. A randomized recurrence
may run earlier or later than the wrapped schedule would, so it should be a
deliberate load-shaping choice.

## When to use it

Skip jitter when the exact delay is meaningful:

- a protocol heartbeat, maintenance tick, or sampling loop must run at a known
  cadence
- a test needs deterministic virtual-time advancement
- a user-visible retry, refresh, or progress check should feel predictable
- a small single-instance loop has no fleet-wide synchronization problem

In those cases, use the schedule that states the real timing requirement:
`Schedule.fixed` for wall-clock cadence, `Schedule.spaced` for a gap after work
finishes, `Schedule.exponential` for deterministic backoff, and
`Schedule.recurs`, `Schedule.take`, or `Schedule.during` for visible bounds.

## When not to use it

Do not add `Schedule.jittered` just because a schedule repeats. A single worker
that drains a local queue every second does not need random timing unless it is
competing with other workers or protecting a shared dependency. A UI path that
promises "try again in 5 seconds" should not sometimes wait 4 seconds and
sometimes 6 seconds. A test that advances `TestClock` by exact intervals should
not depend on a randomized delay range.

Also avoid jitter when the schedule is documenting an external contract. Cron
boundaries, billing windows, lease renewals, and protocol timeouts usually need
predictability more than desynchronization.

## Schedule shape

Choose the deterministic shape first and leave it unjittered when precision is
the requirement. Use `Schedule.fixed` for wall-clock cadence, `Schedule.spaced`
for a gap after work finishes, `Schedule.exponential` for deterministic backoff,
and `Schedule.recurs`, `Schedule.take`, or `Schedule.during` for visible bounds.

## Example

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const predictableStatusPolling = Schedule.spaced("50 millis").pipe(
  Schedule.take(3)
)

const program = Effect.gen(function*() {
  const polls = yield* Ref.make(0)

  const pollUserVisibleStatus = Ref.updateAndGet(polls, (n) => n + 1).pipe(
    Effect.tap((poll) => Console.log(`poll ${poll}: status is still visible`)),
    Effect.as("visible")
  )

  const finalRecurrence = yield* pollUserVisibleStatus.pipe(
    Effect.repeat(predictableStatusPolling)
  )

  yield* Console.log(`stopped after recurrence ${finalRecurrence}`)
})

Effect.runPromise(program)
```

The loop uses a deterministic gap and a deterministic stop condition. Adding
`Schedule.jittered` would change the user-visible rhythm without improving
safety for this single-user workflow.

## Variants

For tests, prefer deterministic schedules and advance virtual time by the exact
delay the schedule promises. Test jittered policies separately by asserting
that delays stay within Effect's `80%` to `120%` jitter range instead of
asserting one exact delay.

For exact wall-clock cadence, prefer `Schedule.fixed`. For "wait this long
after the previous run finishes", prefer `Schedule.spaced`. For a small
single-instance loop, start with the simplest deterministic cadence and add
jitter only after there is an actual coordination or downstream-load problem.

## Notes and caveats

`Schedule.jittered` changes only the recurrence delay. It does not change which
errors are retryable, when a schedule stops, or whether a repeated operation is
safe. If the problem is overload, quota enforcement, or too many concurrent
callers, jitter may be one useful tool, but it is not a replacement for limits,
classification, or admission control.
