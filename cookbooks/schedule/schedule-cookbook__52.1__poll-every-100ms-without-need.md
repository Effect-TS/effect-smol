---
book: Effect `Schedule` Cookbook
section_number: "52.1"
section_title: "Poll every 100ms without need"
part_title: "Part XII — Anti-Patterns"
chapter_title: "52. Polling Too Aggressively"
status: "draft"
code_included: false
---

# 52.1 Poll every 100ms without need

Polling every 100 milliseconds without a clear need is an anti-pattern because
it turns a convenient recurrence policy into constant background pressure. A
single loop looks small. Ten loops already mean roughly one hundred checks per
second. Across services, tenants, browser tabs, or worker fibers, the same
choice can become a steady stream of requests, database reads, lock checks,
metrics writes, and wakeups that compete with useful work.

`Schedule.spaced("100 millis")` is a valid tool when the operation is cheap,
local, bounded, and expected to become ready almost immediately. The problem is
using that shape as the default polling policy for work that does not need that
latency.

## The anti-pattern

The problematic version starts from a fixed 100 millisecond cadence and applies
it before asking how quickly the answer can change or how expensive each check
is. The schedule reads like a harmless detail, but it creates an unbounded loop:
`Schedule.spaced("100 millis")` recurs continuously, spacing each repetition by
that duration until something outside the schedule stops it.

That may be far more aggressive than the domain requires. A batch job that
finishes in minutes, an eventually consistent index, a queue that is usually
empty, or a remote status endpoint with rate limits rarely benefits from ten
checks per second. The extra polls mostly discover the same state again.

## Why it happens

It usually happens when "responsive" is treated as the only scheduling goal. A
100 millisecond interval feels fast enough for humans and easy to remember, so
it gets copied into polling code even when no user is waiting, no service-level
objective depends on that latency, and the polled value cannot change that
quickly.

It also happens when polling code is written while testing a happy path. A short
interval makes tests, demos, and manual verification feel snappy. If that value
is promoted unchanged into production, the schedule no longer documents
operational intent; it documents impatience.

## Why it is risky

The direct cost is load. Every recurrence wakes a fiber, runs the effect, and
usually touches another subsystem. If the poll performs network I/O, storage
I/O, logging, tracing, or metrics, the system pays those costs even when nothing
changed.

The indirect cost is worse during incidents. When a dependency slows down,
aggressive polling adds more concurrent requests to the dependency that is
already struggling. When many callers share the same fixed interval, their
checks can align and produce bursts. When the loop is unbounded, the load keeps
going until interruption, success, or an explicit stopping rule ends it.

Fast polling can also hide missing domain signals. If the right design is an
event, callback, subscription, queue, or "try once and come back later" workflow,
a 100 millisecond loop makes the absence of that signal look acceptable while
charging the system continuously.

## A better approach

Choose the interval from the domain first. Ask how quickly the observed value
can realistically change, who is waiting for it, what each check costs, and what
the maximum acceptable polling budget is. If the answer is "nobody needs this in
100 milliseconds", start with seconds, not milliseconds.

For steady polling, prefer a wider `Schedule.spaced` interval that matches the
freshness requirement. For recovery or readiness checks, prefer a backoff shape
such as `Schedule.exponential` or `Schedule.fibonacci` so repeated misses become
less frequent. For any policy that is not meant to run forever, add an explicit
bound with `Schedule.take`, `Schedule.recurs`, or a time-based limit.

When many processes may poll the same dependency, add jitter after the base
cadence is correct so the fleet does not check in lockstep. Jitter is not a
license to keep an interval too small; it only spreads otherwise reasonable
traffic.

## Notes and caveats

There are valid 100 millisecond schedules. They belong near cheap local
coordination, short-lived startup readiness, tests, and bounded user-facing
waits where that latency is part of the requirement. Even then, make the stop
condition visible.

`Schedule.spaced("100 millis")` controls the delay between recurrences; it does
not make the work cheap, cancel stale demand, or limit the total number of
checks. If the loop is meant to protect a dependency, the schedule should show
that protection through wider spacing, backoff, jitter, and a clear bound.
