---
book: Effect `Schedule` Cookbook
section_number: "59.3"
section_title: "Avoid synchronized retries"
part_title: "Part XIV — Reference Appendices"
chapter_title: "59. Index by Operational Goal"
status: "draft"
code_included: false
---

# 59.3 Avoid synchronized retries

Avoid synchronized retries is a reference-index entry for choosing existing
Schedule recipes when many callers may fail at the same time and then retry the
same dependency. It does not introduce a new Schedule primitive. It maps the
operational risk to jittered, bounded, and fleet-aware retry policies.

## What this section is about

This entry is about retry phase alignment. A retry policy can look reasonable
for one fiber, process, worker, or host while still being unsafe across a fleet.
If many callers observe the same outage, deploy, restart, cache miss, broker
disconnect, or quota response, identical retry schedules can produce identical
future retry windows.

The selection question is: "Will many callers run this policy against the same
shared dependency at roughly the same time?" If the answer is yes, prefer a
policy that spreads callers, limits local retry volume, and respects the shared
capacity boundary.

## Why it matters

Plain exponential backoff reduces pressure over time, but it does not by itself
desynchronize callers that failed together. A group can retry after the same
base delays: 100 milliseconds, 200 milliseconds, 400 milliseconds, and so on.
That repeating shape can keep a downstream system hot during recovery.

Fixed and spaced retries have the same phase problem. `Schedule.fixed` maintains
a wall-clock interval, while `Schedule.spaced` waits for the configured duration
after the previous run. Both are useful, but neither spreads equal callers that
started in the same window. Without jitter or external coordination, synchronized
callers can remain synchronized.

The risk is not only extra traffic. Synchronized retries can amplify outage
recovery, exhaust shared quotas, create broker reconnect storms, overload
control planes, and make metrics appear as periodic spikes rather than a smooth
load curve.

## Core idea

Use `Schedule.jittered` when the main risk is lockstep retry timing. In Effect,
`Schedule.jittered` randomly adjusts each computed recurrence delay between 80%
and 120% of the original delay. It preserves the schedule output and changes
only the delay before the next recurrence.

For transient dependency failures, start from `Schedule.exponential` and apply
`Schedule.jittered` to spread retry attempts around each exponential delay. Add
`Schedule.recurs` or `Schedule.take` so the policy has a local retry limit.
Where the retry must stay within a latency budget, add an elapsed-time bound
such as `Schedule.during` or use a capped-backoff recipe.

For periodic work, use jitter only when exact alignment is not part of the
requirement. A jittered `Schedule.spaced` policy can reduce repeated bursts from
many clients or workers. A `Schedule.fixed` policy is usually the wrong base
when the goal is desynchronization, because fixed cadence is chosen to preserve
alignment to interval boundaries.

## Recipe index

Use "Add jitter to exponential backoff" when callers retry an idempotent remote
operation after transient errors and the main problem is retry bursts around
common exponential delays.

Use "Jittered retries for Redis reconnects" or "Jittered retries for brokers
and queues" when many processes may reconnect after a shared dependency outage.
These cases need jitter because reconnect attempts often begin together after
network partitions, broker failovers, or rolling restarts.

Use "Polling from many clients without synchronization", "Reduce herd effects in
control planes", "Jittered cache warming", or "Smooth demand over time" when
the recurrence is a repeat or polling loop rather than a retry after failure.
The same phase problem applies, but the policy should be described as load
spreading rather than error recovery.

Use "Backoff for unstable remote APIs", "Backoff for broker recovery", or
"Capped backoff for worker processes" when jitter alone is not enough and the
policy also needs increasing delays, a maximum delay, or an operationally
defensible retry budget.

Use "Forgetting that many instances may run the same schedule" when the main
issue is the fleet multiplier itself. That anti-pattern explains why a finite
per-instance policy can still exceed a shared dependency's capacity.

## Practical guidance

Treat jitter as a phase-spreading tool, not as a safety boundary. It reduces the
chance that many callers retry in the same instant, but it does not reduce total
retry volume, enforce a global quota, or make non-idempotent operations safe.

Always pair synchronized-retry mitigation with a stopping rule. `Schedule.jittered`
changes delays; it does not decide when to stop. Use `Schedule.recurs`,
`Schedule.take`, elapsed budgets, predicates at the retry boundary, or
domain-specific failure classification so the policy cannot retry forever by
accident.

Design for the shared dependency, not only the local caller. If the downstream
limit is per tenant, account, region, cluster, token, queue, or provider, the
schedule should be reviewed against that shared limit. A fleet-aware policy may
need lower local retry counts, slower base delays, queue admission, central rate
limiting, lease ownership, partitioning, or server-provided retry delays in
addition to jitter.

Do not use jitter where exact timing is the contract. Heartbeats, leases,
protocol windows, billing periods, maintenance windows, and tests that assert
exact delays may need deterministic schedules or explicit coordination instead
of randomness.
