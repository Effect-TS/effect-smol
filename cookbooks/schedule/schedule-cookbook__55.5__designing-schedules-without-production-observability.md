---
book: Effect `Schedule` Cookbook
section_number: "55.5"
section_title: "Designing schedules without production observability"
part_title: "Part XII — Anti-Patterns"
chapter_title: "55. Ignoring Operational Context"
status: "draft"
code_included: false
---

# 55.5 Designing schedules without production observability

Schedules are production behavior: they decide when work may happen again and
when the policy stops. This entry focuses on making those recurrence decisions
observable.

## The anti-pattern

The problematic version treats `Schedule` as a private timing helper. A retry
policy is attached because `Schedule.exponential("200 millis")` looks
reasonable. A polling loop is attached because `Schedule.spaced("1 second")`
looks harmless. The code may even have sensible bounds with `Schedule.recurs`,
`Schedule.take`, or `Schedule.during`, but no one can answer the production
questions:

- what input caused the recurrence decision
- what delay was actually scheduled
- how many recurrences were accepted
- whether the policy stopped because of success, exhaustion, a fatal input, or
  a domain terminal state
- whether many callers are following the same timing pattern at once

That is not a small documentation gap. It means the schedule is changing the
shape of production traffic while remaining invisible to the people responsible
for the system.

## Why it happens

It usually happens when the delay shape is chosen before the operational signal.
The team decides on exponential backoff, fixed spacing, jitter, or an elapsed
budget, then leaves logging and metrics as a later concern. That order is
backwards for production code. Observability is part of the schedule design
because the schedule owns the recurrence boundary.

`Schedule.tapInput` and `Schedule.tapOutput` exist for this reason. The input
tap observes what is fed into the schedule without changing the policy. With
`Effect.retry`, that input is the failure being considered for retry. With
`Effect.repeat`, that input is the successful value being considered for
repetition. The output tap observes accepted schedule outputs, such as counts,
delays, or mapped values, without changing the timing or stop condition.

The mistake is to add a schedule and then ask a separate layer to infer what
happened. Once the schedule is the boundary that decides recurrence, it should
also expose the fields needed to understand that decision.

## Why it is risky

The first risk is false confidence. A bounded schedule can still be opaque. If a
retry gives up after five accepted recurrences, the final error alone does not
show the attempted delay sequence, the retry count, or the reason each failure
was considered retryable.

The second risk is misleading metrics. A counter for "request failed" hides
whether the request failed immediately, recovered after one retry, exhausted a
retry budget, or stopped because a non-retryable error bypassed the schedule.
A latency histogram without retry attempt counts can make slow dependency
recovery look like ordinary request latency.

The third risk is ambiguous termination. `Schedule.recurs`, `Schedule.take`,
and `Schedule.during` stop recurrence; they do not invent a domain reason such
as "timed out", "budget exhausted", or "terminal failure". The code around
`Effect.retry` or `Effect.repeat` must turn the final error or value into a
termination reason that callers, logs, and metrics can distinguish.

The fourth risk is hidden fleet behavior. `Schedule.jittered` can spread
callers out, but if metrics only record the base policy, operators cannot see
the actual scheduled delays. If logs only say "retrying", they cannot
distinguish controlled backoff from synchronized load or a policy that is still
running after it should have stopped.

## A better approach

Design the schedule and its observability together. Start with the operational
questions the policy must answer, then choose the narrowest schedule that can
answer them.

For retries, classify errors before they reach the retry schedule. The schedule
should only receive failures that are eligible for recurrence. Use
`Schedule.tapInput` for stable failure fields such as error tag, endpoint,
operation, tenant, or dependency name. Use `Schedule.tapOutput` for accepted
recurrences: retry number, computed delay, elapsed budget, or any output
created by combining schedules.

For repetition and polling, remember that the schedule input is usually the
successful value that was just produced. Log or metric the observed status, the
accepted recurrence count, and the next delay. If a terminal domain state stops
the loop, surface that as a different termination reason from an elapsed budget
or a fatal polling error.

For metrics, separate the signals instead of collapsing them into one counter.
Useful dimensions usually include policy name, operation, input classification,
accepted recurrence count, scheduled delay, final outcome, and termination
reason. Keep high-cardinality values out of metric labels; put request ids,
job ids, and detailed causes in logs or traces instead.

For termination, make the final interpretation explicit outside the schedule.
An exhausted retry budget, a non-retryable failure, a successful recovery, a
polling timeout, and a terminal domain result should be different outcomes in
the surrounding Effect workflow. The schedule can provide the recurrence
mechanics and observation hooks, but the domain code owns the final meaning.

For naming, avoid names such as `retryPolicy` or `pollSchedule` when the
production promise is narrower. Names such as
`retryInventoryTimeoutsWithObservedBackoff`,
`pollImportUntilTerminalStatusOrBudget`, or
`retryTokenRefreshWithAttemptMetrics` make the observability contract visible
at the call site.

## Notes and caveats

Observability hooks should not change schedule semantics. `Schedule.tapInput`
and `Schedule.tapOutput` are appropriate because they observe inputs and outputs
without altering them. If logging or metric emission can fail, decide whether
that failure should affect the workflow; most production retry and polling
paths should avoid making telemetry delivery part of the recurrence decision.

Do not log every detail on every recurrence. High-volume schedules need small,
structured events and bounded metrics. The goal is not more noise; the goal is
to make recurrence count, computed delay, input classification, and termination
reason visible enough that production behavior can be explained during an
incident.
