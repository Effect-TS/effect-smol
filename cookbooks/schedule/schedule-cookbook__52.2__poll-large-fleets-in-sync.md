---
book: Effect `Schedule` Cookbook
section_number: "52.2"
section_title: "Poll large fleets in sync"
part_title: "Part XII — Anti-Patterns"
chapter_title: "52. Polling Too Aggressively"
status: "draft"
code_included: false
---

# 52.2 Poll large fleets in sync

## The anti-pattern

Every instance gets the same repeat schedule and starts from the same lifecycle
event: deploy, boot, leader change, cache flush, or incident recovery. A plain
fixed or spaced interval reads as "poll every 30 seconds." Across a fleet it can
mean "ask the same dependency at once."

This is easy to miss with background polling. One worker polling every few
seconds is usually fine. The load shape appears when many identical processes
run the same policy and thousands of workers turn a status endpoint, queue
broker, database, or control plane into the bottleneck even though average
request rate looks acceptable.

## Why it happens

The schedule is designed for one process instead of the fleet.
`Schedule.spaced("30 seconds")` waits after each successful poll completes
before the next one. `Schedule.fixed("30 seconds")` maintains a constant
interval, and if work takes longer than the interval the next run can happen
immediately rather than piling up missed runs. Both are useful; neither spreads
identical clients by itself.

Deployments make the synchronization worse. If every worker starts around the
same time, the first poll aligns. If the work duration is similar, the following
polls can stay aligned. A dependency outage can also re-synchronize clients when
they all begin polling again after the same recovery signal.

## Why it is risky

The risk is burst load, not just total load. A backend sized for a steady 10,000
requests per minute may still fail if most of those requests arrive in a narrow
window every minute. Synchronized polling can create noisy metrics, queue depth
oscillation, periodic database contention, rate-limit bursts, and incident
feedback loops where every client checks more aggressively at the worst time.

It also hides the cause. Operators may see a slow poll endpoint or a database
spike every 30 seconds without an obvious offender because no single instance is
violating its local schedule.

## A better approach

Design the polling policy as a fleet policy. Choose the base cadence from the
freshness requirement and the downstream cost, then add spreading when many
instances may run it. In Effect, `Schedule.jittered` keeps the same general
cadence while randomly adjusting each computed delay between 80% and 120% of the
original delay.

Use jitter for runtime polling loops where exact wall-clock alignment is not a
requirement. Keep it visible in the schedule rather than hiding randomness in
the poll effect, so the operational contract remains reviewable: the cadence
states how often the work should happen, and jitter states that the fleet should
not wake up in lockstep.

If the dependency needs tighter protection, combine jitter with a slower
cadence, a concurrency limit, caching, server-side push, or a poll response that
tells clients when to check again. Jitter smooths synchronization; it does not
make an expensive polling design cheap.

## Notes and caveats

Do not add jitter where precise cadence is the point of the workflow. Heartbeats,
billing boundaries, time-bucketed aggregation, and protocol-level leases may
need explicit timing semantics. For those cases, reduce fleet pressure with
partitioning, ownership, or a separate coordination mechanism instead of random
delay.

Jitter is also not a retry limit or a backpressure mechanism. If the poll loop
can run forever, decide whether that is intentional and document the cost. If the
loop is only useful during a window, pair the cadence with an explicit limit such
as a count or elapsed-time budget.
