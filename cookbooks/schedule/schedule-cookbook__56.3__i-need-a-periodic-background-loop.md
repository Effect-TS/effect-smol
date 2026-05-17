---
book: Effect `Schedule` Cookbook
section_number: "56.3"
section_title: "“I need a periodic background loop”"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "56. Recipe Selection Guide"
status: "draft"
code_included: false
---

# 56.3 “I need a periodic background loop”

Choose this path for successful background work that should run again and again:
health checks, cache refreshes, local metric flushes, maintenance sweeps,
reconciliation passes, or heartbeats.

## What this section is about

Before writing the worker, answer these questions:

- Should the loop wait after each completed run, or try to stay aligned to a
  regular cadence?
- Is the loop allowed to run for the whole process lifetime, or should it stop
  after a count, a window, or a domain condition?
- What happens when the loop is interrupted during sleep or during the work
  itself?
- How will operators see that it is running, falling behind, or stopping?

## Why it matters

Background loops are easy to make unbounded by accident. `Schedule.spaced` and
`Schedule.fixed` both recur continuously unless you add a stopping rule or run
the repeated effect under a lifecycle that can interrupt it.

That is often exactly what a service worker needs, but the choice should be
visible. The schedule should tell a reader whether the loop is quiet between
runs, whether it catches up after slow work, which limits apply, and where
observability is attached.

## Core idea

Start with the cadence.

Use `Schedule.spaced(duration)` when the requirement is "wait this long after a
successful run completes." This is the default shape for most background loops
because slow work naturally pushes the next start later. A cache refresh that
takes three seconds and is repeated with `Schedule.spaced("30 seconds")` starts
the next refresh about thirty seconds after the previous refresh completes.

Use `Schedule.fixed(duration)` when the requirement is "stay on this regular
interval." In `Schedule.ts`, `fixed` keeps a fixed interval and, if the action
takes longer than the interval, the next run happens immediately without
building a backlog of missed runs. That fits probes or ticks where cadence
alignment matters more than quiet time after completion.

Then decide whether the loop is truly lifetime-bound. If it is not, add a
limit:

- Use `Schedule.recurs(n)` when the policy is "allow at most n scheduled
  recurrences after the first run."
- Use `Schedule.take(n)` when you are limiting the outputs taken from another
  schedule.
- Use `Schedule.during(duration)` when the loop should continue only during an
  elapsed schedule window.

Combine an interval and a limit only when both rules are real requirements. For
example, a bounded maintenance loop can be "run every thirty seconds until
twenty recurrences or fifteen minutes have been spent." A process-lifetime
heartbeat may deliberately have no schedule limit, but then cancellation must
come from the owning fiber, scope, or supervisor.

## Practical guidance

Pick `spaced` unless you can explain why fixed cadence matters. `spaced` is
usually easier to reason about because each run completes before the quiet
period begins. Pick `fixed` for clock-like periodic work, and remember that it
does not launch concurrent catch-up executions by itself.

Keep failure handling separate from periodic repetition. `Effect.repeat` uses
the schedule after successful iterations. If a flush, poll, or refresh should
retry on failure, put a short retry policy around that one iteration, then
repeat the recovered operation on the background cadence.

Add jitter when many instances run the same loop against shared infrastructure.
For periodic loops, jitter normally belongs on the repeat schedule so ordinary
successful traffic is spread out. Keep the base interval understandable first;
then apply `Schedule.jittered` to reduce synchronized wakeups.

Make cancellation an explicit ownership decision. A `Schedule` decides whether
and when the next recurrence should happen; it is not the worker's lifecycle.
Run long-lived loops in a scope, fiber set, layer, or supervisor that can
interrupt them during shutdown. If the loop has a natural end, express that in
the schedule or in the repeated effect's result instead of relying on process
exit.

Attach observability to the schedule when the recurrence policy is what you
need to see. `Schedule.tapOutput` can record the recurrence count produced by
`spaced` or `fixed`. `Schedule.tapInput` observes the values supplied to the
schedule, which are successful values for repeats and failures for retries.
For richer decisions, schedule metadata includes attempt, elapsed time,
elapsed time since the previous step, output, and the computed duration.

Prefer a small named schedule over inline composition. Names such as
`refreshEveryMinute`, `boundedStartupWarmup`, or `jitteredMetricsFlush` make the
operational promise visible at the call site.

The common selections are:

- Periodic worker with quiet time after each run: `Schedule.spaced`.
- Clock-like tick that should keep a regular interval: `Schedule.fixed`.
- Temporary maintenance loop: `spaced` or `fixed` plus `recurs`, `take`, or
  `during`.
- Fleet-wide periodic export or refresh: base cadence plus `jittered`.
- Lifetime worker: unbounded cadence plus explicit fiber or scope ownership.
