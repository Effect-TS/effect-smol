---
book: Effect `Schedule` Cookbook
section_number: "59.4"
section_title: "Bound total retry time"
part_title: "Part XIV — Reference Appendices"
chapter_title: "59. Index by Operational Goal"
status: "draft"
code_included: false
---

# 59.4 Bound total retry time

Use this index when a retry policy is governed by elapsed time, not just retry
count. The caller has a recovery window, and the policy may schedule another
attempt only while that window remains open.

This is a schedule-level deadline. It controls future retry decisions after
failures. It does not interrupt an attempt that is already running.

## Why it matters

Retry counts are a weak proxy for user or workflow budgets. Ten fast failures
may finish quickly; ten slow calls with growing backoff can hold a request,
worker, or startup path much longer than intended.

A total retry-time budget makes that tolerance explicit. It fits startup
checks, dependency calls, reconnect loops, webhook delivery, cache refresh, and
background jobs where retrying is useful only inside a bounded recovery window.

## Core schedule choices

Use `Schedule.during(duration)` as the elapsed budget. In `Schedule.ts`,
`during` is built from `Schedule.elapsed` and continues while the elapsed
duration is less than or equal to the configured duration. It outputs the
elapsed duration.

`Schedule.during` has no pacing of its own. A fast-failing effect can retry very
quickly while the window is open. Pair it with the cadence you actually want:

- `Schedule.exponential(base)` for transient failures that should back off.
- `Schedule.spaced(duration)` or `Schedule.fixed(interval)` for steady retry
  cadence.
- `Schedule.jittered` when many callers may retry the same dependency at once.
- `Schedule.recurs` or `Schedule.take` when you also need a count cap.

Combine the delay and budget with `Schedule.both`. `both` continues only while
both schedules continue and uses the larger delay, so the delay schedule
controls pacing while `Schedule.during` supplies the elapsed stopping
condition.

## Related recipes

Use [9.1 Retry for at most 10 seconds](schedule-cookbook__09.1__retry-for-at-most-10-seconds.md)
or [9.2 Retry for at most 1 minute](schedule-cookbook__09.2__retry-for-at-most-1-minute.md)
for basic elapsed retry budgets.

Use [9.5 Prefer time budget limits over attempt counts](schedule-cookbook__09.5__prefer-time-budget-limits-over-attempt-counts.md)
when the deadline is the real contract.

Use [39.1 Exponential backoff plus time budget](schedule-cookbook__39.1__exponential-backoff-plus-time-budget.md)
when failures should slow down while the total retry window stays bounded.

Use [38.5 Poll with both interval and deadline](schedule-cookbook__38.5__poll-with-both-interval-and-deadline.md)
for the polling version of the same shape.

## Caveats

Choose the time budget from the caller's contract. Interactive work usually
needs a short budget and a clear final error. Startup and reconnect paths may
accept a larger budget, but should still fail or report exhaustion explicitly.
Background workflows can use longer budgets only when the work remains useful
and observable.

Use a time budget when the deadline matters more than the exact number of
attempts. A slow attempt consumes the same elapsed budget as the following
delay, so the final retry count is an outcome of the operation latency and the
delay policy.

Keep per-attempt deadlines separate. If an individual attempt must be
interrupted after a fixed duration, put a timeout on the retried effect. Use
`Schedule.during` only to decide whether another attempt may be scheduled after
a typed failure.
