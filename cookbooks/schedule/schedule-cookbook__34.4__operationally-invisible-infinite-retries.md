---
book: "Effect `Schedule` Cookbook"
section_number: "34.4"
section_title: "Operationally invisible infinite retries"
part_title: "Part IX — Anti-Patterns"
chapter_title: "34. Retrying Forever"
status: "draft"
code_included: false
---

# 34.4 Operationally invisible infinite retries

## The anti-pattern

A retry schedule is treated as a private implementation detail. The effect
fails, retries, and nothing outside the fiber can tell whether this is attempt
two or attempt two thousand. The caller sees latency or eventual failure.
Operators see downstream symptoms: repeated API calls, elevated queue age,
extra database reads, or a job that never completes.

This often appears as a tidy shared policy such as unbounded
`Schedule.exponential("200 millis")` or `Schedule.spaced("1 second")`. Those
schedules are real tools. The policy is incomplete when it has no retry budget,
no elapsed time budget, no classification of retryable failures, and no signal
for each retry attempt.

## Why it happens

The schedule is chosen before the operation has an operational contract. The
code decides to retry a transient failure, then postpones the harder questions:
which errors are transient, how long the caller may wait, whether the side
effect is idempotent, and what signal should be emitted on each recurrence.

`Schedule` makes recurrence compositional, so an unbounded policy is easy to
pass to `Effect.retry`. That composability is useful, but the absence of a bound
is still a policy. If no one combines the schedule with `Schedule.recurs`,
`Schedule.take`, `Schedule.during`, or another stopping condition, the retry can
continue as long as the fiber is alive.

## Why it is risky

Invisible retries hide both product failures and infrastructure failures. A
malformed request remains malformed. A revoked credential will not become valid
through backoff. A non-idempotent write can duplicate work outside the process.
A downstream outage can be amplified by every caller running the same loop.

The risk is worse during incidents. If retry attempts are not counted, logs lack
attempt numbers and causes, and metrics do not expose retry volume, the team
cannot distinguish a few slow operations from many permanently failing ones.
Without elapsed-time or attempt limits, retry traffic may continue after the
business deadline has passed.

Backoff can also create false confidence. `Schedule.exponential` and
`Schedule.fibonacci` reduce retry pressure over time, but they do not make the
retry finite. `Schedule.jittered` spreads callers out, but it does not provide a
budget. Delay is not observability, and it is not termination.

## A better approach

Make the retry contract explicit before choosing the cadence. Classify failures
first, retry only cases that are expected to recover, and give the policy a
count budget, a time budget, or both. Combine the delay policy with a stopping
policy such as `Schedule.recurs`, `Schedule.take`, or `Schedule.during`. When
many callers may retry at the same time, add `Schedule.jittered`, but keep the
limits visible.

Make each recurrence observable. `Schedule.tapInput` can record the failure that
caused a retry. `Schedule.tapOutput` can record schedule output, such as delay
or recurrence count. Where elapsed time matters, use a time-limited policy or
compose with `Schedule.elapsed` so logs and metrics can answer how many attempts
happened, why they happened, how long the operation has been retrying, and when
the policy stopped.

Prefer metrics with stable dimensions over ad hoc log volume. Useful signals
include retry attempts by operation and error class, retry exhaustion counts,
elapsed retry duration, selected-delay histograms, and the number of fibers
currently waiting to retry. Logs should carry operation name, classified error,
attempt number, elapsed time, and the final exhaustion event.

Name retry policies after their operational promise:
`retryHttp503ForThirtySeconds`, `retryConnectionResetFiveTimes`, or
`pollUntilReadyWithinStartupBudget` is clearer than `defaultRetrySchedule`.

## Notes and caveats

Some systems deliberately retry forever, such as long-lived background workers
or supervisors. That is acceptable only when the retry is visible and externally
controllable: structured logs, metrics, alerting, backoff, jitter where
appropriate, and a documented shutdown or cancellation path.

Do not use infinite retry to hide a request-scoped failure from a caller that
needs a timely answer. A bounded retry may surface errors sooner; that is the
point when work has left its useful window.
