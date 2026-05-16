---
book: Effect `Schedule` Cookbook
section_number: "51.3"
section_title: "Unbounded backoff chains"
part_title: "Part XII — Anti-Patterns"
chapter_title: "51. Retrying Forever"
status: "draft"
code_included: false
---

# 51.3 Unbounded backoff chains

Unbounded backoff chains are an anti-pattern because they make a retry policy look increasingly conservative while the operation itself remains alive forever. The growing delay can hide the problem from dashboards and operators, but it does not create a real recovery contract. It only stretches the failure into a long tail.

## The anti-pattern

The problematic version uses an unbounded backoff schedule as the whole retry story. A policy based on `Schedule.exponential("200 millis")` looks reasonable at first because each attempt waits longer than the last. In `Schedule`, however, `exponential` is a schedule that always recurs. By itself, it has no maximum attempt count, no elapsed time budget, and no maximum single delay.

That means the schedule can keep a failed operation around long after the caller, job, or incident response process expects a decision. After enough attempts the next sleep may be minutes or hours away, but the work is still pending and may still retry later.

## Why it happens

It happens when "back off" is treated as the same thing as "bound the retry." Exponential growth reduces pressure on a downstream service, but it does not decide when the original operation has failed. The operator name can make the policy feel safer than a tight loop, so the missing stop condition is easy to miss in review.

It also happens when a shared backoff is reused for different workflows. A queue reconnect loop, a user-facing request, a startup probe, and a control-plane mutation may all benefit from backoff, but they should not inherit the same unlimited lifetime.

## Why it is risky

The long tail is the main risk. Early attempts are visible and close together, but later attempts are far apart. A failing job can look quiet even though it is still scheduled to act. That makes ownership ambiguous: the caller may have moved on, the worker may still hold state, and the next retry may happen after the surrounding context is no longer valid.

Unbounded delay also creates poor operational semantics. A very large next wait can be indistinguishable from a stuck process. If the operation eventually retries, it may do so after credentials, leases, idempotency windows, request deadlines, or deployment assumptions have changed. For unsafe side effects, that late retry can be worse than failing promptly.

The backoff curve does not protect the system from all load either. Many callers using the same unbounded policy can still accumulate delayed work. Without jitter, similar failures can retry together. Without a deadline, the backlog can persist through recovery and produce traffic long after the original incident.

## A better approach

Treat backoff as the cadence, not the limit. Start with the retryable case, then add explicit bounds that match the workflow:

- use `Schedule.recurs` when the contract is a maximum number of retries
- use `Schedule.during` when the contract is a wall-clock retry budget
- use `Schedule.modifyDelay` with `Duration.min` when each sleep needs a maximum cap
- use `Schedule.jittered` when many fibers or processes may run the same policy together

For example, an exponential cadence can still be appropriate when a remote service is temporarily overloaded. The safer policy also says when to stop and how long any single sleep is allowed to become. That gives the caller a clear exhausted-retry outcome instead of leaving the operation in a remote future.

Prefer names that include the bound, such as "retry transient inventory reads for up to 20 seconds" or "reconnect with at most 10 capped backoff attempts." A name like "exponential retry" describes the curve but not the operational promise.

## Notes and caveats

Caps and deadlines solve different parts of the problem. A delay cap prevents one recurrence from sleeping too long. A deadline or recurrence limit decides when the retry as a whole is over. Most production policies need both: a maximum gap between attempts and a maximum lifetime for the operation.

Be careful with schedule combinators. Intersection-style composition with `Schedule.both` stops when the first component stops and uses the maximum delay between components, which is usually what you want when combining a cadence with a limit. Union-style composition keeps going while either side still wants to recur, which can accidentally preserve the unbounded tail.

A bounded policy may surface failures sooner than the previous unbounded one. That is a feature, not a regression, when the old behavior was only delaying a decision. If the workflow truly needs indefinite background recovery, make that explicit with monitoring, cancellation, jitter, and a bounded per-attempt delay rather than hiding it behind an uncapped exponential chain.
