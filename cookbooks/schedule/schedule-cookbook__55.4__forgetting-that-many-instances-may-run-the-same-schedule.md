---
book: Effect `Schedule` Cookbook
section_number: "55.4"
section_title: "Forgetting that many instances may run the same schedule"
part_title: "Part XII — Anti-Patterns"
chapter_title: "55. Ignoring Operational Context"
status: "draft"
code_included: false
---

# 55.4 Forgetting that many instances may run the same schedule

When many instances run the same schedule, a modest local policy can become a
coordinated workload. Review the fleet, tenants, and shared dependency behind
the recurrence.

## The anti-pattern

The problematic version designs the schedule from the perspective of one
operation and then reuses it across many workers. Each instance is well behaved
in isolation: the retry count is finite, the polling interval is not tiny, and
the loop may even have a clear stop condition. The missing part is the
multiplier.

For example, `Schedule.recurs(5)` limits one failed call to five recurrences. It
does not limit the fleet. If 2,000 workers hit the same dependency, the policy
can authorize up to 10,000 additional attempts after the original 2,000 calls.
Likewise, `Schedule.spaced("30 seconds")` describes the delay for one repeated
operation. If all instances start together, finish work in similar time, and use
the same spacing, they can continue waking up in the same window.

The anti-pattern is treating the schedule as if it owns the global budget. It
does not. A `Schedule` decides whether one execution should recur and what delay
that execution should use. It does not know how many other services, pods,
tenants, queue partitions, or browser clients are stepping the same policy.

## Why it happens

It usually happens because schedules are small, reusable values. That is one of
their strengths, but it can make the operational boundary look smaller than it
is. A retry policy reviewed in a unit test has one caller. A background poller
run locally has one loop. A deployed service may have hundreds of copies of that
same logic, all created from the same image and started by the same rollout.

Synchronization also appears naturally. Deploys, restarts, cache invalidations,
leader elections, queue backlogs, and dependency outages can cause many
instances to begin a schedule at nearly the same time. Without randomness or
coordination, identical schedules produce similar next delays. The result is
not just more traffic; it is traffic with a repeating shape.

Quotas make the mistake sharper. Many APIs enforce limits per account, tenant,
project, region, token, or downstream cluster, not per process. A per-instance
schedule can respect its own retry budget while the group exceeds the shared
allowance.

## Why it is risky

The risk is fleet-wide multiplication. Local recurrence counts multiply by
instance count, concurrency, partitions, and tenants. If the repeated work
touches a database, message broker, third-party API, control plane, or rate
limited endpoint, the schedule can create a burst that is much larger than the
single-call review suggested.

Spacing alone is not enough when many callers share the same phase.
`Schedule.spaced` waits the configured duration from the last run of that
execution, which is useful for local cadence. It does not spread equal clients
that started together. A 30-second spacing can still mean a 30-second burst
cycle if every worker wakes in the same few milliseconds.

Jitter helps with this specific shape. In Effect, `Schedule.jittered` randomly
adjusts each computed recurrence delay between 80% and 120% of the original
delay. That spreads callers around the base cadence and reduces lockstep
behavior. It does not reduce total demand, create capacity, enforce a global
quota, or make unsafe retries safe.

The hardest failures are often indirect. The system may look fine per instance
while the shared dependency sees periodic spikes, quota exhaustion, retry
storms, noisy metrics, or recovery delays. Operators then see a downstream
incident without one obvious bad actor because every caller followed its local
schedule correctly.

## A better approach

Design the policy as a fleet policy before choosing the combinators. Start with
the shared constraint: downstream capacity, provider quota, database write
budget, acceptable staleness, or maximum recovery pressure. Then divide that
budget across the number of instances and concurrent operations that may run
the schedule.

Use count limits such as `Schedule.recurs` or `Schedule.take` to make the local
budget explicit, but name and review them as per-execution limits. Use spacing
to express the intended local cadence. Add `Schedule.jittered` when many
instances may otherwise retry or repeat together, especially after deployments,
regional restarts, or dependency recovery.

When the dependency enforces a shared quota, do not rely on per-instance
schedules alone. Use slower spacing, smaller retry counts, queue admission,
central rate limiting, lease ownership, partitioning, server-provided
`Retry-After` delays, or provider-specific quota coordination. Jitter is a load
spreading tool; quota protection needs an actual quota-aware mechanism.

Keep the fleet assumption visible in the name or nearby documentation. A policy
called `retryTransientApiFailure` says less than
`retryTransientApiFailureWithinTenantQuota`. The latter forces reviewers to ask
how many callers share the tenant quota and whether the schedule is still
appropriate after a scale-out.

## Notes and caveats

Do not add jitter to workflows that require exact wall-clock alignment or
protocol-defined timing. Heartbeats, leases, billing windows, and scheduled
aggregation may need coordination rather than randomness.

Also avoid treating a finite local schedule as proof that the system is safe.
Stopping after five retries is useful, but five retries across thousands of
instances can still be too much. The schedule should describe the local
recurrence contract, and the surrounding system should enforce the shared
capacity contract.
