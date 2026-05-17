---
book: "Effect `Schedule` Cookbook"
section_number: "35.5"
section_title: "Using jitter to mask a deeper overload problem"
part_title: "Part IX — Anti-Patterns"
chapter_title: "35. Polling and Jitter Mistakes"
status: "draft"
code_included: false
---

# 35.5 Using jitter to mask a deeper overload problem

Jitter can smooth synchronized recurrence, but it cannot decide whether the
system should accept more work. Random timing is not capacity control.

## Anti-pattern

Synchronized load appears, and jitter becomes the main fix. A hot endpoint is
retried by many callers, a poller hammers a downstream service, or a batch job
fans out more work than the dependency can accept. `Schedule.jittered` shifts
each delay within its `80%` to `120%` band, so a spike becomes a wider plateau.

That graph can look better while the overload remains. If callers still retry
too many times, pollers still have no terminal condition, or workers still admit
unbounded concurrency, the system is still asking the dependency to do more than
it can handle.

## Why it happens

Jitter is cheap to add and often produces an immediate visual improvement. A
jittered exponential backoff reads as more production-ready than the same
backoff without jitter, so it is tempting to stop there.

The missing question is whether the system should be doing the work at all.
Jitter changes when the next recurrence happens. It does not classify
non-retryable failures, cap retry budgets, bound concurrency, queue work behind
backpressure, reject excess demand, or enforce a shared rate limit.

## Why it is risky

Randomized overload is still overload. During a partial outage, jitter can keep
steady pressure on a dependency that needs room to recover. The system may avoid
sharp retry waves while still consuming connection pools, worker slots, request
budgets, and operator attention.

It also hides the real contract from the code. A reader sees a jittered schedule
and may assume the retry or polling policy is operationally safe. If the schedule
has no recurrence limit, no elapsed budget, no input classification, and no
coordination with admission control, the safety is only cosmetic.

Jitter can make telemetry harder to interpret as well. The failure is no longer
a clean synchronized spike; it is smeared across time. That can delay the more
important fix: reducing admitted demand, preserving capacity for healthy work,
or making callers fail fast when the system is already saturated.

## A better approach

Treat jitter as the last timing refinement on top of an already bounded policy.
First decide which work is allowed to recur, how many times it may recur, how
long the recurrence window may stay open, and what should happen when the system
is saturated.

Use schedule operators for the recurrence contract. `Schedule.recurs(n)` or
`Schedule.take(n)` makes a count budget visible. `Schedule.during(duration)`
makes the elapsed recurrence window visible. `Schedule.both` can combine cadence
with a count or time budget so recurrence continues only while both schedules
continue. Add `Schedule.jittered` only when many callers may otherwise align on
the same delay boundaries.

Use the right non-schedule mechanism for overload control. Bound concurrency for
work that consumes scarce worker or connection capacity. Use queues or streams
with backpressure when producers must slow down behind consumers. Use rate
limiting or admission control when excess demand should wait, be rejected, or
receive a clear retry-after signal. Use load shedding when preserving service
health matters more than accepting every request.

The schedule should then describe retry or polling behavior, not carry the full
burden of system protection. A good policy might be jittered, but it is safe
because it is narrow, bounded, and coordinated with capacity controls.

## Caveats

Do not remove jitter from a fleet-wide retry policy just because it is not a
capacity fix. Jitter is still useful for avoiding synchronized recurrence and is
often the correct addition to exponential or spaced delays.

The caveat is ownership. If the system is overloaded, the owner of the policy
must decide what demand is admitted, queued, slowed, or rejected. Jitter can make
that decision less noisy; it cannot make the decision for you.
