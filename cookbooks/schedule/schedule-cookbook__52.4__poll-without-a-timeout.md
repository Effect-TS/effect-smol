---
book: Effect `Schedule` Cookbook
section_number: "52.4"
section_title: "Poll without a timeout"
part_title: "Part XII — Anti-Patterns"
chapter_title: "52. Polling Too Aggressively"
status: "draft"
code_included: false
---

# 52.4 Poll without a timeout

Poll without a timeout is an anti-pattern because it turns "check again later"
into "check forever unless something external happens to stop us." That may be
acceptable for a deliberately owned background fiber, but it is dangerous as the
default shape for job status pages, payment settlement checks, provisioning
flows, export generation, and eventual-consistency reads.

In Effect, schedules make recurrence explicit. That also means an unbounded
polling schedule is an explicit choice to keep asking. If the code does not say
when the polling window closes, the operational system has to discover that
answer through load, stuck fibers, noisy logs, or a user waiting indefinitely.

## The anti-pattern

The problematic version uses a recurring schedule for polling but omits a
terminal condition or elapsed budget. It often starts as a tidy fixed cadence:
poll every second, every five seconds, or with a small backoff. The missing part
is not the delay; the missing part is the rule that says polling is no longer
useful.

This is especially easy to miss when the polled operation usually finishes
quickly. The happy path returns a terminal status, so the absence of a budget
does not show up in local testing. In production, a lost job id, a stuck
downstream workflow, a provider incident, or a caller that has already gone away
can leave the poller alive long after the result has stopped mattering.

## Why it happens

It happens when the schedule is treated as only a cadence. `Schedule.forever`
recurs forever, and repeating a `Schedule.spaced` policy without a limiting
operator has the same practical effect for polling: there is always another
decision point after the next successful observation.

The terminal state is also easy to confuse with the timeout. A status predicate
answers "did the operation finish?" A time budget answers "how long are we
willing to keep observing?" Production polling usually needs both. If either is
missing, the code has an incomplete contract.

## Why it is risky

Unbounded polling spends capacity on work that may no longer have a consumer. A
single caller might be cheap, but many callers with the same unbounded policy can
turn a partial outage into constant read pressure on the very system that is
already failing to make progress.

It also makes failure ambiguous. Did the job fail? Is the status endpoint
broken? Is the job still pending? Did the polling budget expire? Without a
visible terminal policy, all of those cases can collapse into "still waiting."
That is poor behavior for a user-facing request and poor telemetry for an
operator.

## A better approach

Model polling as repeated successful observations with two separate stop rules:

- stop when the latest status is terminal
- stop when the recurrence budget is exhausted

Use `Schedule.while` when the latest successful input or output decides whether
another poll should happen. Use `Schedule.during(duration)` when the policy
needs an elapsed recurrence window. In `Schedule.ts`, `during` is implemented on
top of elapsed schedule time and `Schedule.while`, so it participates in
schedule decisions; it is not a hard interrupt for an in-flight request.

For a polling cadence, combine the spacing with the budget using
`Schedule.both`. Because `both` continues only while both schedules continue, the
polling loop stops when either the status predicate rejects another recurrence
or the elapsed budget is no longer open. Add `Schedule.recurs(n)` or
`Schedule.take(n)` when a count limit communicates the contract more directly
than elapsed time, or combine count and time when both matter.

Keep request timeouts separate. If each status read must finish within two
seconds, put a timeout around that effect. Use `Schedule.during` to bound the
recurrence window, not to cancel a status request that is already running.

## Notes and caveats

Some background monitors really are intended to run indefinitely. In that case,
make ownership explicit: the fiber should be supervised, interruptible, and
observable, and the polling rate should be acceptable even during downstream
incidents. That is different from accidentally leaving a request-scoped poller
without a timeout.

When many clients may poll the same resource, add jitter to the bounded policy
so recurrence boundaries do not synchronize. Jitter changes when each poll
happens; it does not replace the terminal status predicate or the elapsed
budget.
