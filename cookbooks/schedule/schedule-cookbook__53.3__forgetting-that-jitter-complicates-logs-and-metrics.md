---
book: Effect `Schedule` Cookbook
section_number: "53.3"
section_title: "Forgetting that jitter complicates logs and metrics"
part_title: "Part XII — Anti-Patterns"
chapter_title: "53. Misusing Jitter"
status: "draft"
code_included: false
---

# 53.3 Forgetting that jitter complicates logs and metrics

Jitter spreads repeated work, but it also changes what timing telemetry means.
Logs and metrics should make that randomness explicit.

## Anti-pattern

`Schedule.jittered` is added to a retry or repeat policy, but the old logging
and metrics remain. Logs still say "retry in 1 second" even though the selected
delay may be about 800 milliseconds to 1.2 seconds. Dashboards still graph
retry delay as if every caller follows the same deterministic backoff. Alerts
still compare observed gaps against exact values.

The result is confusing incident data. Earlier retries can look like schedule
bugs. Later retries can look like queue lag, scheduler starvation, or downstream
latency. A wider delay distribution looks like instability unless the telemetry
names it as deliberate desynchronization.

## Why it happens

The schedule is treated as control flow: retry with exponential backoff, plus
jitter. The operational record is left behind. Teams reduce synchronized load
but do not update events, metric names, labels, or runbooks to explain why an
attempt's actual delay no longer matches the nominal backoff.

Another cause is instrumenting only the operation being retried. That shows
success or failure, but not what the schedule decided between attempts. With
jitter, the schedule decision is important data: attempt number, policy name,
selected delay, retryable input, and stop condition.

## Why it is risky

Uninstrumented jitter makes healthy policies look suspicious and unhealthy
policies harder to diagnose. Operators can misread expected variance as
latency, queue depth, or clock drift. They may alert on valid waits inside the
`80%` to `120%` jitter range, or miss real delay because the metric already
looks noisy.

It also hides policy mistakes. `Schedule.jittered` does not add a retry limit,
cap exponential growth, or classify errors. A dashboard that only shows
"jittered retries increased" cannot tell whether the system is spreading a
bounded transient retry policy or delaying work that should have stopped.

## A better approach

Instrument the schedule as a policy, not just the retried operation. Keep the
base schedule meaningful, add jitter only where desynchronization is wanted, and
emit telemetry that names the randomization.

At minimum, logs and metrics should separate:

- the policy name, such as `gateway_retry_backoff`
- the attempt or recurrence count
- the input category, such as timeout, connection reset, rate limit, or poll
  miss
- the nominal delay from the base policy, when it is part of the configuration
- the selected delay after jitter
- the jitter range, `80%` to `120%` for `Schedule.jittered`
- the termination budget, such as `Schedule.recurs`, `Schedule.take`, or
  `Schedule.during`
- the final outcome: success, exhausted schedule, non-retryable input, or
  interruption

Use `Schedule.tapInput` when the input to the schedule is the important signal,
such as a typed retry error. Use `Schedule.tapOutput` when the schedule output
captures useful policy state, such as a recurrence counter. Use
`Schedule.delays` at the point that matches the value you need: before jitter to
observe the nominal delay, or after jitter to observe the selected delay.

Dashboards should not expect exact retry timestamps for jittered policies.
Graph ranges and distributions: retry attempts by policy, selected delay
histograms, exhausted retry budgets, retry success after attempt number, and
downstream error categories. Alerts should account for the jitter band rather
than treating every deviation from the base cadence as abnormal.

## Caveats

`Schedule.jittered` is intentionally narrow. It changes the recurrence delay
and leaves the schedule's output type alone. That makes it easy to add to an
existing schedule, but the observability story remains your responsibility.

For deterministic tests, exact cron-like cadence, protocol heartbeats, or
user-visible countdowns, prefer a non-jittered schedule unless the timing
variance is part of the requirement. For production retries across a fleet,
jitter is often appropriate; make the policy, selected delay, budget, and jitter
range visible.
