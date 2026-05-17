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

## The anti-pattern

An unbounded backoff schedule is used as the whole retry policy. A policy based
on `Schedule.exponential("200 millis")` looks conservative because each attempt
waits longer than the last. In `Schedule`, `exponential` always recurs. By
itself it has no maximum attempt count, no elapsed budget, and no maximum single
delay.

Backoff changes pressure; it does not create a recovery contract. After enough
attempts the next sleep may be minutes or hours away, but the work is still
pending and may retry after the caller, job, or incident process expected a
decision.

## Why it happens

It happens when "back off" is treated as "bound the retry." Exponential growth
reduces pressure on a dependency, but it does not decide when the original
operation has failed.

A shared backoff can also leak across workflows. A queue reconnect loop, a
user-facing request, a startup probe, and a control-plane mutation may all need
backoff, but they should not inherit the same lifetime.

## Why it is risky

The long tail is the main risk. Early attempts are visible and close together;
later attempts are far apart. A failing job can look quiet even though it is
still scheduled to act. Ownership becomes ambiguous: the caller may have moved
on, the worker may still hold state, and the next retry may run after the
surrounding context is stale.

A very large next wait can also look like a stuck process. If the operation
eventually retries, it may run after credentials, leases, idempotency windows,
request deadlines, or deployment assumptions have changed. For unsafe side
effects, a late retry can be worse than a clear failure.

Backoff does not eliminate fleet load. Many callers using the same unbounded
policy can accumulate delayed work. Without jitter, similar failures can retry
together. Without a deadline, the backlog can persist through recovery.

## A better approach

Treat backoff as cadence, not limit. Start with the retryable case, then add
explicit bounds that match the workflow:

- use `Schedule.recurs` when the contract is a maximum number of retries
- use `Schedule.during` when the contract is a wall-clock retry budget
- use `Schedule.modifyDelay` with `Duration.min` when each sleep needs a maximum cap
- use `Schedule.jittered` when many fibers or processes may run the same policy together

An exponential cadence is appropriate for temporary overload. A production
policy also says when to stop and how long any single sleep may become. That
gives the caller an exhausted-retry outcome instead of leaving the operation in
a distant future.

Prefer names that include the bound, such as "retry inventory reads for up to
twenty seconds" or "reconnect with ten capped backoff attempts." A name like
`exponentialRetry` describes the curve but not the promise.

## Notes and caveats

Caps and deadlines solve different problems. A delay cap prevents one
recurrence from sleeping too long. A deadline or recurrence limit decides when
the retry as a whole is over. Most production policies need both.

Use schedule combinators deliberately. `Schedule.both` uses intersection
semantics: it continues only while both schedules continue and uses the maximum
delay. That is usually what you want when combining cadence with a limit.
`Schedule.either` uses union semantics and can accidentally preserve an
unbounded tail.

A bounded policy may surface failures sooner. That is expected when the old
behavior only delayed a decision. If a workflow truly needs indefinite
background recovery, make it visible with ownership, cancellation,
observability, jitter where appropriate, and a bounded per-attempt delay.
