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

Exponential backoff is the retry pattern where repeated failures produce
progressively longer waits.

Use this entry when a remote dependency is likely to recover, but repeated immediate retries would amplify the failure. The common production shape is "retry transient failures with growing waits, stop by count or elapsed budget, and add jitter when many callers may retry at once."

## What this section is about

The related `Schedule` constructors and utilities are:

- `Schedule.exponential(base)` recurs forever with delays `base`, `base * 2`, `base * 4`, and so on.
- `Schedule.exponential(base, factor)` uses the supplied growth factor instead of the default factor of `2`.
- `Schedule.recurs(times)` adds a retry-count limit.
- `Schedule.during(duration)` adds an elapsed-time budget.
- `Schedule.jittered(schedule)` randomly adjusts each recurrence delay to between 80% and 120% of the original delay.

The schedule controls delays between retries or repeats. It does not delay the first attempt.

## Why it matters

Exponential backoff is a load-shedding retry policy. It gives a transient remote failure a short chance to clear, then backs away as the evidence grows that the dependency is unavailable, throttled, overloaded, or rate-limiting the caller.

Without limits, exponential backoff can still wait forever. Without jitter, a fleet of callers can synchronize into retry waves. Without a cap or budget, later delays can exceed the product requirement even though the policy looked reasonable at the start.

## Core idea

Start with `Schedule.exponential(base)` when repeated failure should reduce retry pressure on a remote system. Then add the smallest set of constraints that makes the policy safe:

- Add `Schedule.recurs(n)` when the caller should make at most `n` retries.
- Add `Schedule.during(duration)` when the user, request, job, or lease has a total time budget.
- Add `Schedule.jittered` when multiple clients, workers, fibers, or nodes can fail and retry together.
- Add an explicit maximum delay when the remote system or product flow requires a cap.

For capped backoff, combine exponential growth with a delay adjustment such as `Schedule.modifyDelay` so later retries do not exceed the maximum wait. For a custom growth sequence, use `Schedule.unfold` or another constructor only when `Schedule.exponential` cannot describe the policy directly.

## Practical guidance

Use exponential backoff for transient remote failures such as:

- HTTP 429, 503, connection reset, temporary DNS, or gateway failures
- optimistic concurrency conflicts where a short retry is expected to succeed
- queue, lock, or lease acquisition against a shared remote service
- cloud API calls where the provider explicitly recommends backoff

Do not use it as a blanket retry policy for validation errors, authentication failures, permanent missing resources, or non-idempotent writes unless the operation has a safe idempotency key or equivalent protection.

Choose the base delay from the expected recovery time, not from convenience. Use a small base for brief network instability, a larger base for rate limits or overload signals, and a lower factor when the caller needs a gentler increase. Keep the retry count and elapsed budget visible next to the backoff so the worst case is easy to review.

Add jitter by default for service-to-service traffic, scheduled jobs, clients that may share the same clock, and worker fleets. Leave jitter out only when deterministic timing is required and synchronized retries are harmless.

When a remote API publishes retry-after information or a rate-limit reset time, prefer honoring that signal over blindly applying local exponential growth. Exponential backoff is the fallback policy for uncertainty; explicit remote timing is stronger evidence.
