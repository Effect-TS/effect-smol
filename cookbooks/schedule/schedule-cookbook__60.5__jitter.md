---
book: Effect `Schedule` Cookbook
section_number: "60.5"
section_title: "Jitter"
part_title: "Part XIV — Reference Appendices"
chapter_title: "60. Index by Pattern"
status: "draft"
code_included: false
---

# 60.5 Jitter

Jitter means "keep the same recurrence policy, but randomize each computed
delay so many callers do not move together." In `Schedule` terms, the primitive
for this shape is `Schedule.jittered`.

Use this index entry when the primary question is coordination: will many
clients, workers, pods, tabs, or service instances retry or repeat at the same
time if they share the same schedule?

## Source-of-truth mapping

`Schedule.jittered(schedule)` returns a new schedule with the same output,
input, error, and environment types as the schedule it wraps. It changes the
delay selected for each recurrence.

The implementation in `packages/effect/src/Schedule.ts` uses
`Schedule.modifyDelay` and `Random.next` to adjust the selected delay to a
random value between `80%` and `120%` of the original delay.

That means jitter is a delay modifier. It does not change which inputs are
accepted, what the schedule outputs, how many recurrences are allowed, or why the
schedule stops.

## Recipes

Start with [8.4 Avoid synchronized retries in clustered systems](schedule-cookbook__08.4__avoid-synchronized-retries-in-clustered-systems.md)
for the retry case. It maps jitter to herd avoidance after a shared failure and
shows why backoff, jitter, and limits are separate decisions.

Use [19.1 Polling from many clients without synchronization](schedule-cookbook__19.1__polling-from-many-clients-without-synchronization.md)
when the repeated work is polling rather than retrying after failure.

Use [26.2 Coordinated clients](schedule-cookbook__26.2__coordinated-clients.md)
for the general fleet-wide shape: shared start time, shared cadence, shared
failure mode, or shared downstream bottleneck.

Use [27.2 Jittered retries for Redis reconnects](schedule-cookbook__27.2__jittered-retries-for-redis-reconnects.md)
or [27.3 Jittered retries for WebSocket reconnect](schedule-cookbook__27.3__jittered-retries-for-websocket-reconnect.md)
when reconnect storms are the concrete problem.

Use [28.5 Jittered cache warming](schedule-cookbook__28.5__jittered-cache-warming.md)
when the repeated work is background warming and the risk is many instances
refreshing the same kind of data together.

Use [29.5 When not to add jitter](schedule-cookbook__29.5__when-not-to-add-jitter.md)
when exact cadence, protocol timing, or test determinism matters more than
desynchronization.

## How to choose

Choose the deterministic schedule first. Use `Schedule.exponential` when the
right shape is growing backoff, `Schedule.spaced` when the right shape is a
steady gap after each run, and `Schedule.fixed` when the right shape is a
wall-clock cadence.

Then apply `Schedule.jittered` when many independent callers may otherwise
align on the same delay. This is the common herd-avoidance move for cluster
restarts, regional incidents, reconnect loops, shared polling intervals, and
periodic maintenance loops.

Keep the stopping rule separate. Pair jittered schedules with `Schedule.recurs`,
`Schedule.take`, `Schedule.during`, or another explicit limiter when the
operation needs a retry count, recurrence count, or elapsed-time budget.

## Caveats

`Schedule.jittered` uses fixed bounds in Effect: every selected delay is adjusted
to a random value between `80%` and `120%` of the original delay. It does not
accept custom jitter percentages.

Jitter is not rate limiting, admission control, fairness, or idempotency. It can
reduce accidental synchronization, but it cannot make unsafe retries safe or
guarantee a strict downstream quota.

If a maximum delay must be strict, account for where the cap is applied.
Jittering a capped delay can move the actual wait above the base cap; cap after
jitter when the final sleep must not exceed the limit.
