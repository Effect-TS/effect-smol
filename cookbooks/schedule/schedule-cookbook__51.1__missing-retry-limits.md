---
book: Effect `Schedule` Cookbook
section_number: "51.1"
section_title: "Missing retry limits"
part_title: "Part XII — Anti-Patterns"
chapter_title: "51. Retrying Forever"
status: "draft"
code_included: false
---

# 51.1 Missing retry limits

Missing retry limits is an anti-pattern because a retry schedule needs a visible stopping rule, not only a delay shape.

## The anti-pattern

The problematic version uses an open-ended schedule for retrying, often because the delay shape looks reasonable on its own. A policy such as an exponential, fixed, spaced, or repeating schedule can describe when the next retry should happen while still allowing the same failing dependency, unsafe operation, or invalid request to be tried again without a clear end.

That missing second half is the bug. The retry policy has timing, but it has no budget. When the failing effect never succeeds, the schedule can continue to produce retry decisions indefinitely.

## Why it happens

It usually happens when retry behavior is specified in terms of delay first and termination second. The code answers "how long should we wait between failures?" before it answers "how many failures are we willing to tolerate?"

It can also happen when a shared retry policy is reused across operations with different risk profiles. A harmless read, an idempotent write, and a non-idempotent side effect should not all inherit the same unbounded retry behavior.

## Why it is risky

Unbounded retries turn a local failure into continuing operational load. A down dependency receives more traffic while it is least able to handle it. A malformed or unauthorized request is repeated even though another attempt cannot make it valid. A non-idempotent effect can be performed more than once if the remote system completed the work but failed before returning a successful response.

The failure is also harder to observe. The caller does not get a timely exhausted-retry error, and the system may look busy rather than broken. During an incident, those background retries can consume connection pools, queue slots, rate-limit budget, and logs that operators need for the actual recovery.

## A better approach

Make the retry limit part of the schedule itself. If the operation should retry a fixed number of times, use `Schedule.recurs(n)`. In retry usage, that expresses an upper bound on retry recurrences, so `Schedule.recurs(3)` means the original attempt may be followed by at most three retries.

If the useful part of the schedule is the delay shape, keep the delay but cap its outputs with `Schedule.take(n)`. This is useful when the base schedule is `Schedule.exponential`, `Schedule.spaced`, `Schedule.fixed`, or another schedule that would otherwise keep producing retry decisions. The source `Schedule.take` implementation limits the wrapped schedule by the recurrence attempt count, so the cap stays attached to the schedule that creates the delays.

If the retry policy is governed by elapsed time rather than count, use `Schedule.during(duration)`. It builds a schedule from elapsed time and continues only while the elapsed duration is within the supplied duration. For operations such as startup checks or short dependency recovery windows, that makes the retry budget match the operational deadline.

Prefer names that include the limit: `retryTransientHttpErrorsThreeTimes`, `retryTokenRefreshForTenSeconds`, or `retryUploadWithCappedBackoff`. A name that only says "exponential retry" describes the shape but hides the termination rule.

## Notes and caveats

An attempt limit is not a substitute for error classification. Validation errors, authorization failures, malformed requests, and known fatal responses should usually fail without retrying at all. The limit is for failures that are genuinely retryable but still need a stopping point.

Count limits and time limits answer different questions. `Schedule.recurs` and `Schedule.take` bound the number of retry decisions; `Schedule.during` bounds the elapsed retry window. Many production policies need both: a backoff schedule capped by retry count and also constrained by a total duration.
