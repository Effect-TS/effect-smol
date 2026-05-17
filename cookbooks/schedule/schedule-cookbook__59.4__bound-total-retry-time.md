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

Bound total retry time is a reference-index entry for retry policies governed by
elapsed time instead of only retry count.

## What this section is about

Use this entry when a caller has a deadline-like recovery window. The retry
loop may keep scheduling follow-up attempts only while that window remains open,
then surface the last failure when the budget is exhausted.

This is the schedule-level version of a deadline. It limits future retry
decisions. It does not interrupt an attempt that is already running.

## Why it matters

Retry counts are often a poor proxy for user or workflow budgets. Ten retries
with short failures may finish quickly; ten retries with slow calls and growing
backoff may hold a request or worker for much longer than intended.

A total retry-time budget makes the caller's tolerance explicit. It is useful
for startup checks, dependency calls, reconnect loops, webhook delivery, cache
refresh, and background jobs where retrying is useful only inside a bounded
recovery window.

## Core idea

Use `Schedule.during(duration)` as the elapsed budget. In `Schedule.ts`,
`during` is built from `Schedule.elapsed` and continues while the elapsed
duration is less than or equal to the configured duration. It outputs the
elapsed duration.

Do not treat `Schedule.during` as a complete retry policy by itself. It has no
spacing of its own, so a fast-failing effect can retry very quickly while the
window is open. Pair it with the cadence you actually want:

- `Schedule.exponential(base)` for transient failures that should back off.
- `Schedule.spaced(duration)` or `Schedule.fixed(duration)` for steady retry
  cadence.
- `Schedule.jittered` when many callers may retry the same dependency at once.
- `Schedule.recurs` or `Schedule.take` when you also need a count cap.

Combine the delay and budget with `Schedule.both`. `both` continues only while
both schedules continue and uses the maximum delay between them, so the delay
schedule controls pacing while `Schedule.during` supplies the elapsed stopping
condition.

## Practical guidance

Choose the time budget from the caller's contract. Interactive work usually
needs a short budget and a clear final error. Startup and reconnect paths may
accept a larger budget, but should still fail or report exhaustion explicitly.
Background workflows can use longer budgets only when the work remains useful
and observable.

Use a time budget when the deadline matters more than the exact number of
attempts. A slow attempt consumes the same elapsed budget as the following
delay, so the final retry count is an outcome of the operation latency and the
delay policy.

Keep attempt deadlines separate. If each individual attempt must be interrupted
after a fixed duration, put a timeout on the effect being retried. Use
`Schedule.during` to decide whether another attempt may be scheduled after a
typed failure.

Recommended references:

- `Schedule.during` for elapsed retry budgets.
- `Schedule.both` to intersect a delay schedule with that budget.
- `Schedule.exponential`, `Schedule.spaced`, or `Schedule.fixed` for cadence.
- `Schedule.recurs` or `Schedule.take` for a second count-based bound.
- `Schedule.jittered` when the bounded retries may happen across many clients.
