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

The problematic version starts with a convenient schedule such as exponential backoff, fixed polling, or a small recurrence count, then applies it to every failure from the downstream call. It treats `429 Too Many Requests`, quota exhaustion, capacity throttling, validation failures, and transient transport errors as if they were the same kind of input.

That is the wrong boundary. `Schedule` can describe when another attempt is allowed, but it should not erase the meaning of the failure that selected the policy. If the downstream system has a rate limit, retry budget, reset time, or "do not retry" class, that information must shape both classification and timing.

## Why it happens

It usually happens when rate limits are modeled as comments, dashboards, or tribal knowledge instead of inputs to the recurrence decision. The local code sees only "the call failed", so a shared retry helper attaches `Schedule.exponential`, `Schedule.spaced`, or `Schedule.recurs` without asking whether the next attempt is permitted by the downstream contract.

It also happens when teams confuse backoff with compliance. Backoff reduces pressure after repeated failures, but it does not automatically respect a quota window, a per-tenant allowance, a global account cap, or a server-provided retry time.

## Why it is risky

The risk is not only that the operation fails again. The schedule can turn one rejected call into a burst of additional rejected calls, and many workers can multiply that burst. During an incident, retries that ignore throttling signals compete with useful traffic and make recovery slower.

Quota errors also carry different semantics from ordinary transient errors. A short network interruption may justify a bounded retry. A monthly quota exhaustion should usually stop, surface the problem, and avoid spending more attempts. A rate-limit response with a reset time should delay until the reset, not until a locally chosen exponential step happens to fire.

## A better approach

Classify the downstream response before choosing the schedule. Separate retryable transport failures from non-retryable request failures, rate-limit responses, capacity throttles, and quota exhaustion. The classification should decide whether the effect is retried at all and which schedule applies to the retryable branch.

Use schedule operators to encode the operational promise explicitly. `Schedule.recurs` and `Schedule.take` make attempt budgets visible. `Schedule.during` makes elapsed retry budgets visible. `Schedule.spaced` describes a steady cadence, while `Schedule.exponential` describes increasing delay after repeated failure. `Schedule.jittered` helps desynchronize many callers, but it is not a substitute for respecting an explicit downstream reset time or shared quota.

When a downstream system provides retry guidance, prefer a policy that follows that guidance over a generic local delay. When the limit is global or per tenant, the schedule is only one part of the control: admission control, shared rate limiting, or queueing may need to sit before the effect so the recurrence policy cannot exceed the allowance.

## Notes and caveats

A quota-aware policy may look less reusable than a generic retry helper, but that is the point. The useful abstraction is not "retry this operation"; it is "retry this classified condition while staying inside the downstream contract." That keeps `Schedule` aligned with operational intent instead of hiding quota violations behind tidy recurrence code.
