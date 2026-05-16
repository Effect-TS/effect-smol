---
book: Effect `Schedule` Cookbook
section_number: "56.4"
section_title: "“I need to avoid overload”"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "56. Recipe Selection Guide"
status: "draft"
code_included: false
---

# 56.4 “I need to avoid overload”

Avoiding overload is a selection problem before it is a scheduling problem. The
goal is not to make retries more persistent. The goal is to keep one caller,
one worker, or one fleet from adding traffic faster than a dependency can absorb
it.

This entry does not introduce a new `Schedule` primitive. It helps choose an
existing recipe shape: fixed spacing for steady work, backoff for contention,
jitter for fleets, caps for long tails, budgets for termination, and
classification for deciding whether the schedule should run at all.

## What this section is about

Use this entry when the main risk is extra pressure on a shared resource:
database reconnects, HTTP retries against a struggling service, queue
redelivery, webhook delivery, cache refreshes, background polling, or
maintenance workers.

The useful question is: "what is the maximum load this policy can add while
things are already unhealthy?" Answer that before choosing the combinators.

## Why it matters

Retry and repeat policies can multiply traffic. A single fast retry loop may be
harmless in isolation, but many clients running the same loop can synchronize
into a thundering herd. A background worker that polls too quickly can compete
with foreground traffic. A retry policy without a budget can keep a dependency
hot long after the original work stopped being useful.

`Schedule` makes the recurrence policy visible, but visibility only helps when
the chosen shape matches the operational risk.

## Core idea

Start conservative and add pressure only when you can justify it.

| Need | Prefer | Why |
| --- | --- | --- |
| Keep a steady gap between attempts | `Schedule.spaced` | It waits the same duration between recurrences. This is usually safer than a tight loop for polling, workers, and maintenance tasks. |
| Run on wall-clock boundaries | `Schedule.fixed` | It aligns to interval boundaries. Be careful: if work runs behind, the next delay can become zero, so it is not the default overload-avoidance choice. |
| Slow down after repeated failure | `Schedule.exponential` | It starts at the base duration and grows by the factor, defaulting to `2`. It does not stop by itself. |
| Build a custom increasing delay | `Schedule.unfold` plus `Schedule.addDelay` | Use this when the delay curve is domain-specific and should be named or explained. |
| Desynchronize many clients | `Schedule.jittered` | It adjusts each delay to a random value between 80% and 120% of the incoming delay. |
| Limit the number of recurrences | `Schedule.recurs` or `Schedule.take` | Use count limits when every additional recurrence adds meaningful load or cost. |
| Limit total elapsed time | `Schedule.during` | Use time budgets when the work stops being useful after a deadline. |
| Require multiple guardrails | `Schedule.both` | It continues only while both schedules continue and uses the larger delay. This is the usual way to combine backoff with count and time limits. |

## Practical guidance

Choose the schedule by the overload mechanism.

If the problem is a tight loop, add spacing first. `Schedule.spaced` is the
plainest answer when every recurrence should leave breathing room after the
previous run. Prefer it for worker loops, polling, refreshes, and maintenance
jobs where regularity is more important than immediate recovery.

If the problem is retry pressure against an unhealthy dependency, use backoff.
`Schedule.exponential` is the standard starting point because later failures
become less aggressive. Pick a base delay that would still be acceptable if
every caller used it at the same time.

If the problem is synchronized clients, add jitter. `Schedule.jittered` changes
the delay range, not the stop condition. Apply it to spread retries across the
fleet, then decide whether a strict maximum delay is required.

If the problem is unbounded tail behavior, cap and budget the policy. Use a
maximum delay when operators need to know the longest single wait. Use
`Schedule.recurs` or `Schedule.take` when the number of extra attempts matters.
Use `Schedule.during` when the total elapsed time matters more than the exact
count.

If the problem is mixed failure modes, classify before retrying. Timeouts,
temporary unavailability, and rate-limit responses may deserve conservative
retry. Validation errors, authorization failures, permanent configuration
errors, and unsafe non-idempotent side effects usually should not enter the
retry schedule at all.

## Selection checklist

Before choosing the recipe, answer these questions:

- What shared resource is protected: a service, database, queue, provider quota,
  CPU pool, or user-facing path?
- Is the operation safe to retry, or does it need idempotency first?
- Should the first retry be delayed, or is one quick retry acceptable?
- Should later attempts become slower with `Schedule.exponential`?
- Will many clients run the same policy, requiring `Schedule.jittered`?
- What is the largest acceptable single delay after jitter and any cap?
- What is the maximum number of extra attempts?
- What is the maximum elapsed budget?
- Which error or result classes must stop immediately?

## Common selections

For a fragile downstream service, choose exponential backoff, jitter, a maximum
delay, a retry count, an elapsed budget, and a retryable-error classifier. This
is the safest general-purpose overload shape.

For low-risk background polling, choose `Schedule.spaced` with a count or
elapsed budget if the work should eventually stop. Add jitter only when many
instances poll the same dependency.

For provider quotas or rate limits, choose slower spacing or backoff and treat
rate-limit responses as their own class. Do not handle them like ordinary
network glitches if the provider is explicitly asking the client to slow down.

For user-facing workflows, keep the budget short. Avoid making a person wait
through a background-worker retry policy. Prefer a small number of attempts and
a clear failure path over long invisible retrying.

For fleet-wide recovery after an incident, favor larger base delays, jitter, and
strict limits. The aggregate behavior matters more than one process recovering
as quickly as possible.

## Notes and caveats

`Schedule.exponential`, `Schedule.spaced`, `Schedule.fixed`, and
`Schedule.jittered` do not impose a useful operational limit by themselves.
Pair them with `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or an
input-aware stop condition.

`Schedule.jittered` in Effect uses an 80%-120% range. If the maximum delay must
be strict, cap after jitter with a delay modifier instead of assuming the base
backoff cap remains exact.

`Schedule.both` has intersection semantics: it continues only while both sides
continue and chooses the larger delay. That is usually what overload protection
wants. A composition that continues while either side continues can extend
traffic longer than intended.

Client-side scheduling reduces retry pressure, but it is not a replacement for
server-side rate limits, queues, backpressure, circuit breakers, or load
shedding.
