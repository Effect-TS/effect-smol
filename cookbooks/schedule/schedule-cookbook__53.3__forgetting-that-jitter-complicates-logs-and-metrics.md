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

Jitter spreads repeated work, but it also changes what logs and metrics should
mean. This section focuses on observability that still reports a deterministic
cadence after individual delays have been randomized.

## The anti-pattern

The problematic version adds `Schedule.jittered` to a retry or repeat policy
and keeps the old logging and metrics unchanged. Logs still say "retry in 1
second" even though the actual retry may happen anywhere from about 800
milliseconds to 1.2 seconds. Dashboards still graph retry delay as if every
caller follows the same deterministic backoff. Alerts still compare observed
gaps against exact values.

This creates confusing incident data. A retry that fires earlier than the base
delay can look like a schedule bug. A retry that fires later can look like queue
lag, scheduler starvation, or downstream latency. Aggregated metrics may show a
wider distribution of retry times after jitter is added, but without explicit
labels the change looks like timing instability rather than deliberate
desynchronization.

## Why it happens

It usually happens because the schedule is viewed only as control flow:
"retry with exponential backoff, plus jitter." The operational record is left
behind. Teams add jitter to reduce synchronized load, but they do not update
the events, metric names, labels, or runbooks that explain why a single
attempt's delay no longer matches the nominal backoff.

Another common cause is instrumenting only the operation being retried. That
tells you whether the call succeeded or failed, but not what the schedule
decided between attempts. With jitter, the decision itself is important data:
the attempt number, the base policy, the jittered delay, the retryable input,
and the stop condition are the difference between useful randomness and a
mystery gap.

## Why it is risky

The risk is not that jitter is unreliable. The risk is that uninstrumented
jitter makes a healthy policy look suspicious and makes an unhealthy policy
harder to diagnose.

Without schedule-aware telemetry, operators can misread expected variance as
latency, event-loop delay, queue depth, or clock drift. They may raise alerts on
perfectly valid waits inside the `80%` to `120%` jitter range, or miss a real
problem because the metric already looks noisy. During an outage, this weakens
the main benefit of jitter: reducing synchronized retry pressure while still
understanding how much work is being retried.

It also hides policy mistakes. `Schedule.jittered` does not add a retry limit,
does not cap exponential growth, and does not classify errors. If the dashboard
only shows "jittered retries increased," it may be impossible to tell whether
the system is spreading a bounded transient retry policy or repeatedly delaying
work that should have stopped.

## A better approach

Instrument the schedule as a policy, not just the retried operation. Keep the
base schedule meaningful, add jitter only where desynchronization is wanted,
and emit telemetry that makes the randomization explicit.

At minimum, logs and metrics should separate:

- the policy name, such as `gateway_retry_backoff`
- the attempt or recurrence count
- the input category, such as timeout, connection reset, rate limit, or poll
  miss
- the unjittered base delay when that value is available from the schedule
  shape or policy configuration
- the actual delay selected by the schedule after jitter
- the jitter range, which is `80%` to `120%` for `Schedule.jittered`
- the termination budget, such as `Schedule.recurs`, `Schedule.take`, or
  `Schedule.during`
- the final outcome: success, exhausted schedule, non-retryable input, or
  interruption

Use `Schedule.tapInput` when the input to the schedule is the important signal,
such as a typed retry error. Use `Schedule.tapOutput` when the schedule output
captures useful policy state, such as an exponential delay or recurrence
counter. Use `Schedule.delays` when the next delay is the value you want to
observe. If you need to compare base delay with the adjusted delay, make that
part of the policy design instead of trying to infer it afterward from
timestamps.

Dashboards should not expect exact retry timestamps for jittered policies.
Graph ranges and distributions: retry attempts by policy, selected delay
histograms, exhausted retry budgets, retry success after attempt number, and
downstream error categories. Alerts should account for the jitter band rather
than treating every deviation from the base cadence as abnormal.

## Notes and caveats

`Schedule.jittered` is intentionally narrow. It changes the recurrence delay
and leaves the schedule's output type alone. That makes it easy to add to an
existing schedule, but it also means the rest of the observability story is
your responsibility.

Do not remove jitter just because logs became harder to read. If many callers
can fail together, jitter may be protecting the dependency from synchronized
retry bursts. Fix the instrumentation instead: name the policy, record the
selected delay, preserve the retry budget, and make the jitter range visible in
runbooks and alerts.

For deterministic tests, exact cron-like cadence, protocol heartbeats, or
user-visible countdowns, prefer a non-jittered schedule unless the timing
variance is part of the requirement. For production retries across a fleet,
jitter is often appropriate, but only when the telemetry explains the
intentional randomness.
