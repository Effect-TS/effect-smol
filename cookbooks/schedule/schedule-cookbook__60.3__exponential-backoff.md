---
book: Effect `Schedule` Cookbook
section_number: "60.3"
section_title: "Exponential backoff"
part_title: "Part XIV — Reference Appendices"
chapter_title: "60. Index by Pattern"
status: "draft"
code_included: false
---

# 60.3 Exponential backoff

Use this index when repeated failures should produce progressively longer waits.
Exponential backoff gives a transient failure a short chance to clear, then
reduces retry pressure as evidence grows that the dependency is unavailable,
overloaded, throttling, or rate-limiting the caller.

The common production shape is: retry only classified transient failures, grow
the delay, stop by count or elapsed budget, and add jitter when many callers may
retry together.

## API mapping

- `Schedule.exponential(base)` recurs forever with delays `base`, `base * 2`,
  `base * 4`, and so on.
- `Schedule.exponential(base, factor)` uses the supplied growth factor instead
  of the default `2`.
- `Schedule.recurs(times)` or `Schedule.take(times)` adds a count limit.
- `Schedule.during(duration)` adds an elapsed-time budget.
- `Schedule.jittered(schedule)` randomizes each selected delay between 80% and
  120% of the original delay.

The schedule controls delays between retries or repeats. It does not delay the
first attempt.

## How to choose

Start with `Schedule.exponential(base)` when repeated failure should slow the
caller down. Add the smallest constraints that make the policy reviewable:

- `Schedule.recurs(n)` when the caller should make at most `n` retries.
- `Schedule.during(duration)` when the user, request, job, or lease has a total
  time budget.
- `Schedule.jittered` when multiple clients, workers, fibers, or nodes may fail
  and retry together.
- A cap when later waits must not exceed a product or operations limit.

For a custom growth sequence, use `Schedule.unfold` or another constructor only
when `Schedule.exponential` cannot describe the policy directly.

## Related recipes

Use [6.1 Basic exponential backoff](schedule-cookbook__06.1__basic-exponential-backoff.md)
for the smallest exponential retry policy.

Use [24.1 Backoff for unstable remote APIs](schedule-cookbook__24.1__backoff-for-unstable-remote-apis.md)
or [24.3 Backoff for broker recovery](schedule-cookbook__24.3__backoff-for-broker-recovery.md)
for remote dependencies.

Use [38.2 Retry 5 times with exponential backoff](schedule-cookbook__38.2__retry-5-times-with-exponential-backoff.md)
when the retry count must be visible.

Use [39.1 Exponential backoff plus time budget](schedule-cookbook__39.1__exponential-backoff-plus-time-budget.md)
when elapsed time is the stronger bound.

Use [60.4 Capped backoff](schedule-cookbook__60.4__capped-backoff.md) when a
maximum single delay is part of the contract.

## Caveats

Do not use exponential backoff as a blanket retry policy for validation errors,
authentication failures, permanent missing resources, or non-idempotent writes
unless the operation has a safe idempotency key or equivalent protection.

Choose the base delay from the expected recovery time, not convenience. Use a
small base for brief network instability, a larger base for rate limits or
overload signals, and a lower factor when the caller needs a gentler increase.
Keep the retry count and elapsed budget visible next to the backoff so the worst
case is easy to review.

Add jitter for service-to-service traffic, scheduled jobs, clients that may
share a clock, and worker fleets. Leave jitter out only when deterministic
timing is required and synchronized retries are harmless.

When a remote API publishes retry-after information or a rate-limit reset time,
prefer that signal over local exponential growth. Exponential backoff is the
fallback policy for uncertainty; explicit remote timing is stronger evidence.
