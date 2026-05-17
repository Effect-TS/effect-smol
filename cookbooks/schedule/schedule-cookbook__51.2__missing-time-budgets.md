---
book: Effect `Schedule` Cookbook
section_number: "51.2"
section_title: "Missing time budgets"
part_title: "Part XII — Anti-Patterns"
chapter_title: "51. Retrying Forever"
status: "draft"
code_included: false
---

# 51.2 Missing time budgets

Missing time budgets are an anti-pattern because they make a retry policy look
bounded while leaving its real cost open. A count such as `Schedule.recurs(5)`
answers how many retry decisions may be made, but not how long the caller may
wait.

## The anti-pattern

The problematic policy has a delay curve and a retry count, but no elapsed
budget. It might say `Schedule.exponential("200 millis").pipe(Schedule.both(Schedule.recurs(8)))`
and appear safe because the number of retries is finite.

That policy still leaves the caller exposed to the sum of every delay plus the
runtime of every failed attempt. If the remote call hangs near its own timeout,
if the exponential delays grow larger than expected, or if the retry count is
copied into a slower workflow, the total wait can exceed the caller's useful
window even though the schedule is "bounded."

The anti-pattern is not "using retry counts." Counts are useful. The
anti-pattern is using counts as a substitute for an elapsed budget when the
operation has a latency promise, lease window, startup deadline, user request
deadline, operational recovery window, or capacity reservation.

## Why it happens

It usually happens because attempt counts are easy to review. "Retry 5 times"
looks concrete in a pull request, while "stay within 2 seconds" requires the
author to think about caller ownership and failure latency.

It also happens when teams confuse different limits:

- a delay cap limits one pause before the next recurrence
- `Schedule.recurs(n)` limits scheduled retries after the original attempt
- `Schedule.take(n)` limits schedule outputs
- `Schedule.during(duration)` limits the schedule's elapsed recurrence window
- a timeout around the effect limits an individual in-flight attempt

These limits protect different things. Replacing one with another changes the
operational promise.

## Why it is risky

Attempt counts do not compose with variable latency. Five fast failures may be
acceptable for an interactive caller. Five slow failures may hold the request,
worker, lock, connection, or startup path long past the point where useful work
could still happen.

Counts also age badly as the schedule evolves. A later change from fixed spacing
to exponential backoff, a higher per-attempt timeout, or a larger delay cap can
multiply total elapsed time without changing the visible retry count. Reviewers
see the same count and miss the larger budget.

The caller pays for elapsed time, not for the number of times the schedule was
consulted. Missing time budgets can therefore create retry tails, hold scarce
resources, delay fallback paths, and hide overload until the system is already
under pressure.

## A better approach

Keep the attempt count when it is useful, but add an elapsed budget whenever the
caller owns a maximum retry window. In Schedule terms, compose the cadence with
`Schedule.during(duration)` using `Schedule.both`. The cadence decides when the
next retry may happen. The `during` side decides whether the elapsed schedule
window is still open. Because `Schedule.both` continues only while both sides
continue, retrying stops as soon as either the count or the time budget is
exhausted.

Prefer names that state the promise: `retryPaymentLookupForTwoSeconds`,
`startupConfigRetryBudget`, or `webhookDeliveryRetryWindow` communicate more
than `retryPolicy`. The name should tell the next reader who is being protected
by the elapsed budget.

Use an attempt count to prevent excessive work inside the budget. Use an elapsed
budget to protect the caller from waiting too long. Use a per-attempt timeout
when one attempt also needs a hard maximum duration. These are complementary
guards, not alternatives.

## Notes and caveats

`Schedule.during` is evaluated at schedule decision points. It does not
interrupt an attempt that is already running, and it is not a replacement for a
timeout around the effect itself.

With `Effect.retry`, the first attempt runs immediately. `Schedule.recurs(n)`
allows up to `n` retries after that original attempt, not `n` total executions.
If the operation succeeds, the retry schedule is no longer consulted.

Elapsed budgets make failure earlier and clearer. That is the point: callers can
fall back, surface a timely error, enqueue background work, or release resources
instead of waiting through a retry tail that the attempt count failed to reveal.
