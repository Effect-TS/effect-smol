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

Jitter is a load-spreading tool, not a precision tool. This section covers
schedules whose cadence is part of a protocol, measurement, lease, or
user-facing promise.

## The anti-pattern

The problematic version starts with a deterministic cadence such as
`Schedule.fixed`, `Schedule.spaced`, or deterministic backoff, then pipes it
through `Schedule.jittered` because jitter sounds generally safer. In Effect,
the jittered delay is randomly chosen between `80%` and `120%` of the delay
produced by the wrapped schedule, so the result no longer preserves the timing
promise the original cadence expressed.

This often appears in shared helpers. A team creates a standard "production
schedule" that adds jitter to every retry, polling loop, heartbeat, refresh, or
maintenance task. The helper prevents synchronized bursts for some workloads,
but it also leaks random timing into workloads where exact timing is part of the
requirement.

## Why it happens

It usually happens because jitter is associated with resilience. For clustered
systems, that association is often correct: spreading retries can reduce herd
effects against a shared dependency. The mistake is treating that fleet-level
benefit as a default property of every schedule.

`Schedule` values document recurrence. When precision matters, the absence of
jitter is also part of that documentation. A fixed heartbeat, a polling interval
shown to a user, a sampling loop used for measurements, or a virtual-time test
depends on predictability. Adding jitter makes those systems harder to reason
about even though the code may look more operationally sophisticated.

## Why it is risky

The first risk is violating an external contract. Protocol heartbeats, lease
renewals, lock refreshes, timeout probes, and rate windows often assume a
specific cadence or deadline margin. A delay that is 20% later than the base
delay may be acceptable for a retry storm, but it can be wrong for a renewal
loop that was sized around a precise safety margin.

The second risk is corrupting observability. Metrics sampling, load tests,
diagnostic probes, and periodic reports often rely on deterministic spacing so
measurements are comparable. Jitter can make the system look less bursty while
also making the data less faithful to the question being measured.

The third risk is user-visible inconsistency. If the UI says "refreshing every
5 seconds" or "retrying in 10 seconds", a jittered schedule means the behavior
can happen early or late relative to the promise. The variance may be small, but
it is still deliberate variance in a place where the product asked for a
predictable rhythm.

Tests suffer too. A deterministic schedule can be exercised with exact virtual
time advancement. A jittered schedule needs range-based assertions and random
control. Adding jitter to code that does not need desynchronization makes tests
less precise without improving production behavior.

## A better approach

Choose the schedule shape that states the real timing requirement and leave it
unjittered when precision is the requirement. Use `Schedule.fixed` when the
work should align to a fixed cadence. Use `Schedule.spaced` when the requirement
is a stable gap after the previous run. Use deterministic `Schedule.exponential`
when backoff should be predictable. Add `Schedule.recurs`, `Schedule.take`, or
`Schedule.during` to make bounds explicit.

Reserve `Schedule.jittered` for cases where synchronized callers are the bigger
problem than exact per-caller timing. Good candidates include many service
instances retrying the same downstream dependency, many clients polling the
same resource, or many workers waking after a shared outage. In those cases,
the 80% to 120% delay range is a load-shaping feature.

Name schedules after the behavior they promise. A name like
`leaseRenewalCadence` should make reviewers suspicious of jitter. A name like
`jitteredReconnectBackoff` makes the tradeoff explicit: the policy is allowed
to move individual attempts because aggregate spreading matters more.

## Notes and caveats

Jitter changes only the delay chosen for the next recurrence. It does not add a
retry limit, make an unsafe operation safe, classify errors, or enforce a
global rate cap. If a precise schedule is overloading a dependency, first ask
whether the cadence, concurrency, or admission control is wrong. Jitter may be
part of the answer for a coordinated fleet, but it should not be used to blur a
timing contract that the program depends on.
