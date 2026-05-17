---
book: Effect `Schedule` Cookbook
section_number: "55.3"
section_title: "Ignoring rate limits and downstream quotas"
part_title: "Part XII — Anti-Patterns"
chapter_title: "55. Ignoring Operational Context"
status: "draft"
code_included: false
---

# 55.3 Ignoring rate limits and downstream quotas

Rate limits and downstream quotas make recurrence a shared constraint. A retry
or polling policy has to respect the system that owns the allowance, not only
the caller that wants another attempt.

## The anti-pattern

The mistake is starting with a convenient schedule, then applying it to every
downstream failure. `429 Too Many Requests`, quota exhaustion, capacity
throttling, validation failures, and transient transport errors are different
inputs and should not all receive the same recurrence policy.

`Schedule` can describe when another attempt is allowed, but it should not
erase the meaning of the failure that selected the policy. If the downstream
system has a rate limit, retry budget, reset time, or "do not retry" class, that
information must shape both classification and timing.

## Why it happens

Rate limits often live in comments, dashboards, or team memory instead of the
recurrence decision. The local code sees only "the call failed", so a shared
helper attaches `Schedule.exponential`, `Schedule.spaced`, or `Schedule.recurs`
without asking whether the next attempt is permitted by the downstream
contract.

Backoff is not compliance. It reduces pressure after repeated failures, but it
does not automatically respect a quota window, a per-tenant allowance, a global
account cap, or a server-provided retry time.

## Why it is risky

The risk is not only another failure. A schedule can turn one rejected call into
several additional rejected calls, and many workers can multiply the burst.
During an incident, retries that ignore throttling signals compete with useful
traffic and slow recovery.

Quota errors carry different semantics from ordinary transient errors. A short
network interruption may justify a bounded retry. Monthly quota exhaustion
should usually stop and surface the problem. A rate-limit response with a reset
time should delay until the reset, not until a local exponential step happens
to fire.

## A better approach

Classify the downstream response before choosing the schedule. Separate
retryable transport failures from non-retryable request failures, rate-limit
responses, capacity throttles, and quota exhaustion. The classifier should
decide whether the effect is retried at all and which schedule applies to the
retryable branch.

Use schedule operators to encode the promise explicitly. `Schedule.recurs` and
`Schedule.take` make count budgets visible. `Schedule.during` makes elapsed
budgets visible. `Schedule.spaced` describes a steady cadence, while
`Schedule.exponential` describes increasing delay after repeated failure.
`Schedule.jittered` helps desynchronize many callers, but it is not a
substitute for an explicit downstream reset time or shared quota.

When the downstream system provides retry guidance, prefer that guidance over a
generic local delay. When the limit is global or per tenant, the schedule is
only one control. Admission control, shared rate limiting, or queueing may need
to sit before the effect so recurrence cannot exceed the allowance.

## Notes and caveats

A quota-aware policy may look less reusable than a generic retry helper. That is
usually correct. The useful abstraction is not "retry this operation"; it is
"retry this classified condition while staying inside the downstream contract."
That keeps `Schedule` aligned with operational intent instead of hiding quota
violations behind tidy recurrence code.
