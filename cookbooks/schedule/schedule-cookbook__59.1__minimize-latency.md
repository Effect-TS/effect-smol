---
book: Effect `Schedule` Cookbook
section_number: "59.1"
section_title: "Minimize latency"
part_title: "Part XIV — Reference Appendices"
chapter_title: "59. Index by Operational Goal"
status: "draft"
code_included: false
---

# 59.1 Minimize latency

Use this index when the main budget is latency: the time a caller waits before
it gets an answer. A low-latency policy retries or polls quickly, but only when
the next attempt is cheap, safe, likely to succeed soon, and explicitly bounded.

The first execution is already immediate. `Schedule` controls only later
recurrences: retries after typed failures with `Effect.retry`, or repeats after
successful observations with `Effect.repeat`.

## Core schedule choices

- Use `Schedule.recurs(n)` for immediate retries. `n` is the number of retries
  after the original attempt, not the total number of attempts.
- Use a small `Schedule.spaced(duration)` delay when a zero-delay loop would be
  too aggressive but the caller still benefits from a quick second attempt.
- Use `Schedule.fixed(interval)` only when regular interval boundaries are part
  of the requirement. If work overruns the interval, the next recurrence can be
  immediate.
- Use `Schedule.while` or `Effect.retry({ while })` when a domain predicate
  should stop recurrence before the count or time budget is spent.
- Add `Schedule.recurs`, `Schedule.take`, or `Schedule.during` whenever the
  fast path needs a clear end.

## Related recipes

Use [21.1 Immediate retries](schedule-cookbook__21.1__immediate-retries.md)
when the failure window is shorter than any useful sleep and the retry count is
deliberately tiny.

Use [5.1 Retry every 100 milliseconds](schedule-cookbook__05.1__retry-every-100-milliseconds.md)
when the policy needs a short pause instead of immediate retries.

Use [18.2 Slow polling after initial responsiveness matters less](schedule-cookbook__18.2__slow-polling-after-initial-responsiveness-matters-less.md)
when the first responsive phase should hand off to a slower cadence.

Use [57.2 Immediate responsiveness vs infrastructure safety](schedule-cookbook__57.2__immediate-responsiveness-vs-infrastructure-safety.md)
when local latency competes with fleet-wide load.

Use [59.4 Bound total retry time](schedule-cookbook__59.4__bound-total-retry-time.md)
when elapsed user-facing time matters more than the exact number of retries.

## Caveats

Treat low latency as a short exception, not a default. A fast policy should
normally be bounded by a small recurrence count, a short elapsed-time budget, or
a predicate that stops as soon as the condition is no longer transient.

Do not use fast retries for validation errors, authorization failures, malformed
requests, known permanent states, missing configuration, or non-idempotent
writes that cannot be safely repeated.

If failures persist beyond the responsive window, fail visibly or switch to a
safer policy: slower `Schedule.spaced`, `Schedule.exponential` or
`Schedule.fibonacci` backoff, and `Schedule.jittered` when many callers may
otherwise retry together.
