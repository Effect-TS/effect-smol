---
book: "Effect `Schedule` Cookbook"
section_number: "34.2"
section_title: "Missing time budgets"
part_title: "Part IX — Anti-Patterns"
chapter_title: "34. Retrying Forever"
status: "draft"
code_included: false
---

# 34.2 Missing time budgets

## The anti-pattern

A retry policy has a delay curve and a retry count, but no elapsed budget. It
looks bounded because the number of retries is finite. It is still open-ended in
the dimension the caller often cares about: total time.

The caller pays for every delay plus every failed attempt. If each attempt can
run near its own timeout, or if a fixed delay later becomes exponential, a small
retry count can still exceed the useful window for a request, lease, startup
path, or recovery workflow.

Retry counts are useful. The mistake is treating a count as a time budget when
the operation has a deadline.

## Why it happens

Attempt counts are easy to review. "Retry five times" looks concrete, while
"stay within two seconds" requires thinking about caller ownership, failure
latency, and how long the result remains useful.

It also comes from mixing up different guards:

- a delay cap limits one pause before the next recurrence
- `Schedule.recurs(n)` limits scheduled retries after the original attempt
- `Schedule.take(n)` limits schedule outputs
- `Schedule.during(duration)` limits the schedule's elapsed recurrence window
- a timeout around the effect limits an individual in-flight attempt

They protect different things. Replacing one with another changes the contract.

## Why it is risky

Attempt counts do not compose cleanly with variable latency. Five fast failures
may be acceptable for an interactive caller. Five slow failures may hold a
request, worker, lock, connection, or startup path long after useful work is no
longer possible.

Counts also age badly as the schedule evolves. A later change from fixed spacing
to exponential backoff, a higher per-attempt timeout, or a larger delay cap can
multiply total elapsed time while the visible count stays the same.

Missing time budgets create retry tails: long, low-visibility periods where work
is still waiting, resources are still held, and fallback paths are delayed.

## A better approach

Keep the attempt count when it is useful, but add an elapsed budget whenever the
caller owns a maximum retry window. In Schedule terms, compose the cadence with
`Schedule.during(duration)` using `Schedule.both`. The cadence decides when
another retry may happen. The `during` side decides whether the elapsed schedule
window is still open. Because `Schedule.both` continues only while both
schedules continue, retrying stops when either guard is exhausted.

Prefer names that state the promise: `retryPaymentLookupForTwoSeconds`,
`startupConfigRetryBudget`, or `webhookDeliveryRetryWindow` communicate more
than `retryPolicy`.

Use an attempt count to prevent excessive work inside the budget. Use an elapsed
budget to protect the caller from waiting too long. Use a per-attempt timeout
when one attempt needs its own maximum duration. These are complementary guards,
not alternatives.

## Notes and caveats

`Schedule.during` is evaluated at schedule decision points. It does not
interrupt an attempt that is already running, and it is not a replacement for a
timeout around the effect itself.

With `Effect.retry`, the first attempt runs immediately. `Schedule.recurs(n)`
allows up to `n` retries after that original attempt, not `n` total executions.
If the operation succeeds, the retry schedule is no longer consulted.

Elapsed budgets make failure earlier and clearer. That is the point: callers can
fall back, return a timely error, enqueue background work, or release resources
instead of waiting through a retry tail.
