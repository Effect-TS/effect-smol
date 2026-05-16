---
book: Effect `Schedule` Cookbook
section_number: "51.4"
section_title: "Operationally invisible infinite retries"
part_title: "Part XII — Anti-Patterns"
chapter_title: "51. Retrying Forever"
status: "draft"
code_included: false
---

# 51.4 Operationally invisible infinite retries

Operationally invisible infinite retries are an anti-pattern because they let an operation fail forever without producing the operational evidence needed to understand, limit, or stop it. In Effect, several useful schedules recur forever unless you bound them: `Schedule.forever` has no delay, `Schedule.spaced` repeats at a fixed spacing, and `Schedule.exponential` or `Schedule.fibonacci` keep producing larger delays. Those schedules are not wrong, but using them for retry without logging, metrics, alerts, and limits turns failure into background activity.

## The anti-pattern

The problematic version treats a retry schedule as private implementation detail. A request fails, the effect retries, and nothing outside the fiber can tell whether this is attempt two or attempt two thousand. The caller sees latency or eventual failure, operators see no structured signal, and dashboards show only downstream symptoms: extra database traffic, repeated API calls, elevated queue age, or a job that never completes.

This often appears as a tidy shared policy such as an unbounded `Schedule.exponential("200 millis")` or `Schedule.spaced("1 second")`. The policy looks responsible because it contains delay, but it still has no retry budget, no elapsed time budget, no classification of retryable failures, and no way to count or observe each retry attempt.

## Why it happens

It happens when the schedule is chosen for control flow before the operation has an operational contract. Developers decide that a transient service failure should be retried, but they postpone the harder questions: which errors are transient, how many retries are acceptable, how long the caller may wait, whether the side effect is idempotent, and what signal should be emitted on each recurrence.

`Schedule` makes recurrence compositional, so an unbounded policy is easy to pass to `Effect.retry`. That composability is useful, but it also means the absence of a bound is a real policy. If no one combines the schedule with `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or another stopping condition, the retry can continue as long as the fiber is alive.

## Why it is risky

Invisible retries hide both product failures and infrastructure failures. A malformed request retried forever is still malformed. A revoked credential will not become valid through backoff. A non-idempotent write can duplicate work outside the process. A downstream outage can be amplified by every caller running the same invisible loop.

The operational risk is worse during incidents. If retry attempts are not counted, logs do not include attempt numbers or causes, and metrics do not expose retry volume, the team cannot distinguish a small number of slow operations from a large number of permanently failing ones. Without elapsed-time or attempt limits, retry traffic may continue after the business deadline has passed, making recovery harder for the dependency that is already failing.

There is also a false sense of safety around backoff. `Schedule.exponential` and `Schedule.fibonacci` reduce retry pressure over time, but they do not make the retry finite. `Schedule.jittered` can spread callers out, but it does not provide a budget. Delay is not the same thing as observability, and it is not the same thing as termination.

## A better approach

Make the retry contract explicit before choosing the schedule. Classify failures first, retry only the cases that are expected to recover, and give every retry policy both a count budget and, when the caller has a deadline, a time budget. In Schedule terms, combine the delay policy with a stopping policy such as `Schedule.recurs`, `Schedule.take`, or `Schedule.during`. When many callers may retry at the same time, add `Schedule.jittered`, but keep the explicit limits.

Make each retry visible. Use `Schedule.tapInput` to record the failure that caused the retry and `Schedule.tapOutput` to record the schedule output, such as the next delay or recurrence count. Where elapsed time matters, compose with `Schedule.elapsed` or use a time-limited policy so logs and metrics can answer concrete questions: how many attempts happened, why they happened, how long the operation has been retrying, and when the policy stopped.

Prefer metrics with stable dimensions over ad hoc log noise. Useful signals include retry attempts by operation and error class, retry exhaustion counts, elapsed retry duration, next-delay histograms, and the number of fibers currently waiting to retry. Logs should include the operation name, classified error, attempt number, elapsed time, and final exhaustion event. Alerts should usually be based on retry rate, retry exhaustion, and sustained elapsed time, not on a single failed attempt.

Name retry policies after their operational promise: `retryTransientHttp503ForThirtySeconds`, `retryConnectionResetFiveTimes`, or `pollUntilReadyWithinStartupBudget` is clearer than `defaultRetrySchedule`. A name that mentions the limit makes the absence of a limit visible during review.

## Notes and caveats

Some systems deliberately retry forever, such as long-lived background workers or supervisors. That is acceptable only when the retry is operationally visible and externally controllable: it should have structured logs, metrics, alerting, backoff, jitter where appropriate, and a documented shutdown or cancellation path. Even then, do not use an infinite retry to hide a request-scoped failure from a caller that needs a timely answer.

A bounded retry may surface errors sooner than an invisible infinite retry. That is usually the point. Once the retry budget is explicit, callers can handle exhaustion, operators can see the failing dependency or bad input, and the system can stop spending resources on work that has left its useful window.
