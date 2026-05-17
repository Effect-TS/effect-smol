---
book: "Effect `Schedule` Cookbook"
section_number: "34.1"
section_title: "Missing retry limits"
part_title: "Part IX — Anti-Patterns"
chapter_title: "34. Retrying Forever"
status: "draft"
code_included: false
---

# 34.1 Missing retry limits

## The anti-pattern

A retry policy describes when another attempt may happen but never says when
to stop. The delay shape can look reasonable: exponential backoff, fixed
spacing, or a shared "retry transient errors" schedule. The problem is that
timing is not a budget.

If the effect never succeeds, the schedule can keep producing retry decisions
for the lifetime of the fiber. That turns a temporary recovery mechanism into
an open-ended workload.

## Why it happens

The code answers "how long should we wait between failures?" before it answers
"how many failures are acceptable?" Delay is easy to tune locally; termination
requires understanding the caller, the dependency, and the side effect.

This also appears when one shared policy is reused across operations with
different risk profiles. A safe read, an idempotent write, and a non-idempotent
side effect should not inherit the same retry lifetime.

## Why it is risky

Unbounded retries convert one failure into continuing operational load. A down
dependency receives more traffic while it is least able to handle it. A
malformed request, expired credential, or authorization failure is repeated even
though another attempt cannot make it valid.

Unsafe side effects are worse. If a remote service completed the work but failed
before returning success, an unbounded retry can perform the operation more than
once.

The caller also loses a timely exhausted-retry error. During an incident, these
background retries can consume connection pools, queue slots, rate-limit budget,
and log volume that operators need for recovery.

## A better approach

Put the stopping rule in the policy. Use `Schedule.recurs(n)` when the contract
is a maximum number of retries; with `Effect.retry`, the original attempt runs
first and `Schedule.recurs(3)` permits at most three retries after it.

When the useful part is the delay shape, keep it and cap it with
`Schedule.take(n)`. This works for schedules such as `Schedule.exponential`,
`Schedule.spaced`, or `Schedule.fixed`, which otherwise continue to produce
recurrence decisions.

When the contract is elapsed time, use `Schedule.during(duration)`. It continues
only while the schedule's elapsed recurrence window remains within the supplied
duration. Startup checks and short dependency recovery windows usually need
this kind of time budget.

Name policies after both cadence and limit: `retryHttp503ThreeTimes`,
`retryTokenRefreshForTenSeconds`, or `retryUploadWithCappedBackoff`. A name like
`exponentialRetry` describes the curve but hides the operational promise.

## Notes and caveats

An attempt limit is not error classification. Validation errors, authorization
failures, malformed requests, and known fatal responses should usually fail
without retrying at all.

Count limits and time limits answer different questions. `Schedule.recurs` and
`Schedule.take` bound recurrence count; `Schedule.during` bounds elapsed
schedule time. Production policies often need both.
