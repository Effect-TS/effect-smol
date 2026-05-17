---
book: Effect `Schedule` Cookbook
section_number: "53.1"
section_title: "Adding jitter where precise cadence matters"
part_title: "Part XII — Anti-Patterns"
chapter_title: "53. Misusing Jitter"
status: "draft"
code_included: false
---

# 53.1 Adding jitter where precise cadence matters

Jitter is for spreading load, not for preserving precision. Avoid it when the
schedule's cadence is part of a protocol, measurement, lease, or user-facing
promise.

## Anti-pattern

A deterministic cadence, such as `Schedule.fixed`, `Schedule.spaced`, or
predictable backoff, is piped through `Schedule.jittered` because jitter sounds
safer in production.

That changes the policy. `Schedule.jittered` randomly adjusts each computed
delay to a value between `80%` and `120%` of the original delay. A five-second
cadence becomes a bounded range around five seconds, not an exact interval.

The mistake often hides in shared helpers: a "production schedule" adds jitter
to retries, pollers, heartbeats, refreshes, and maintenance tasks. It may reduce
synchronized bursts for some workloads, but it also injects timing variance into
workloads whose correctness depends on predictable recurrence.

## Why it happens

Jitter is associated with resilience because it helps clustered systems avoid
herd effects, where many callers hit the same dependency at the same time. That
benefit is real, but it is a fleet-level load decision, not a default property
of every schedule.

`Schedule` values document recurrence. For fixed heartbeats, user-visible
polling intervals, sampling loops, lease renewals, and virtual-time tests, the
absence of jitter is part of the contract.

## Why it is risky

Jitter can violate external contracts. Protocol heartbeats, lock refreshes,
timeout probes, and lease renewals often rely on a specific margin. A delay that
is 20% later than the base delay may be fine for retry traffic, but wrong for a
renewal loop sized around a fixed deadline.

It can also weaken observability. Sampling, load tests, diagnostic probes, and
periodic reports often rely on deterministic spacing so measurements remain
comparable. Jitter can make a graph look smoother while making the data less
faithful to the question being measured.

The variance can become visible to users too. If the interface says "refreshing
every 5 seconds", a jittered schedule no longer implements that exact promise.
Tests become less precise for the same reason: deterministic schedules can use
exact virtual-time advancement, while jittered schedules need range assertions
and controlled randomness.

## A better approach

Choose the schedule shape that states the timing requirement and leave it
unjittered when precision matters. Use `Schedule.fixed` when work should align
to a fixed interval. Use `Schedule.spaced` when each run should wait a stable
gap after the previous run. Use deterministic `Schedule.exponential` when the
retry curve should be predictable. Add `Schedule.recurs`, `Schedule.take`, or
`Schedule.during` for explicit bounds.

Reserve `Schedule.jittered` for cases where synchronized callers are the bigger
problem than exact per-caller timing: many service instances retrying the same
dependency, many clients polling the same resource, or many workers waking after
a shared outage. In those cases, the `80%` to `120%` range is the feature.

Name schedules after the behavior they promise. A name like
`leaseRenewalCadence` should make jitter look suspicious. A name like
`jitteredReconnectBackoff` makes the tradeoff explicit.

## Caveats

Jitter changes only the delay chosen for the next recurrence. It does not add a
retry limit, make an unsafe operation safe, classify errors, or enforce a rate
cap. If a precise schedule overloads a dependency, first check cadence,
concurrency, and admission control. Jitter may still help a coordinated fleet,
but it should not blur a timing contract the program depends on.
