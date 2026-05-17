---
book: Effect `Schedule` Cookbook
section_number: "13.2"
section_title: "Run every 10 seconds"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "13. Repeat Periodically"
status: "draft"
code_included: true
---

# 13.2 Run every 10 seconds

Use this when successful background work should run now and then recur on a
ten-second cadence.

## Problem

A heartbeat, local status poller, or small cache refresh needs an immediate
first run followed by successful recurrences every ten seconds.

## When to use it

Use `Schedule.fixed("10 seconds")` when the ten-second interval is the
operational signal and successful runs should stay close to that cadence.

This fits cheap background work owned by a long-lived scope, supervised fiber,
or process.

## When not to use it

Do not use this for failure recovery. `Effect.repeat` repeats after success; if
the effect fails, repetition stops with that failure.

Do not use a ten-second loop for expensive maintenance work that belongs on a
minute-scale or longer interval.

Do not put an unbounded repeat in a request-response path that must return to
its caller.

## Schedule shape

The core schedule is `Schedule.fixed("10 seconds")`.

With `fixed`, slow runs do not create a backlog. If a run takes longer than ten
seconds, the next run may start immediately after it completes. Use
`Schedule.spaced("10 seconds")` instead when each successful run must be
followed by a full ten-second pause.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let heartbeats = 0

const sendHeartbeat = Effect.gen(function*() {
  heartbeats += 1
  yield* Console.log(`heartbeat ${heartbeats}`)
})

const loop = sendHeartbeat.pipe(
  Effect.repeat(Schedule.fixed("10 seconds"))
)

const program = loop.pipe(
  Effect.timeoutOrElse({
    duration: "50 millis",
    orElse: () =>
      Console.log(`demo stopped after ${heartbeats} heartbeat`)
  })
)

Effect.runPromise(program)
```

The timeout keeps the example short. In production, the same loop usually runs
inside a scope or supervised fiber.

## Variants

Use `Schedule.spaced("10 seconds")` when the requirement is a ten-second gap
after each completed run. Add `Schedule.take(n)` for diagnostics or tests that
must stop after a known number of recurrences.

## Notes and caveats

The schedule does not delay the first run. It controls only recurrences after a
successful execution.

`Schedule.fixed("10 seconds")` is unbounded by itself. It completes only if the
effect fails, the schedule fails, or the fiber is interrupted.

If transient failures should not stop the ten-second loop, handle retry or
recovery inside the repeated effect before applying the periodic repeat.
