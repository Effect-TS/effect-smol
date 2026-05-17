---
book: Effect `Schedule` Cookbook
section_number: "51.5"
section_title: "Background loops with no escape hatch"
part_title: "Part XII — Anti-Patterns"
chapter_title: "51. Retrying Forever"
status: "draft"
code_included: false
---

# 51.5 Background loops with no escape hatch

Background loops with no escape hatch are an anti-pattern because they turn a
useful recurrence policy into a process that can only be stopped from the
outside.

## The anti-pattern

The problematic version starts a recurring effect in the background and treats
the schedule as the whole design:

- repeat every few seconds forever
- retry reconnects forever
- poll until success, but with no timeout
- log failures and continue indefinitely
- fork the loop and never retain, supervise, or interrupt the fiber

The schedule may be valid as a schedule. `Schedule.forever` recurs forever with
zero delay. `Schedule.spaced("30 seconds")` recurs continuously with a delay
between runs. These are real tools, not mistakes, and they can be the right
timing shape for a worker, heartbeat, subscription refresh, or polling loop. The
anti-pattern is using them as a lifecycle policy without deciding when the
process should stop, who owns it, what failure budget it has, how much work it
can accumulate, and how anyone will notice that it is stuck.

This often shows up as a "fire-and-forget" maintenance loop: refresh a cache,
renew a lease, publish metrics, scan a queue, reconcile state, or reconnect a
client. The first version works in local testing because the process is short
lived. In production, the same loop can survive across request cancellation,
deployment drains, lost leadership, disabled tenants, expired credentials, or a
downstream outage.

## Why it happens

It usually happens when recurrence is designed before ownership. A schedule is a
small value, so it is easy to attach `Effect.repeat` or `Effect.retry` to an
operation and move on. The code reads as intentional because the delay is named,
but the important operational questions have not been answered.

Another cause is confusing "runs forever" with "is managed forever".
`Schedule.forever` and unbounded `Schedule.spaced` policies describe when the
next recurrence is allowed. They do not decide that the loop should outlive a
request, survive a scope closing, ignore shutdown, or keep running after its
business purpose has disappeared.

The problem is worse when retry and repeat are mixed together. A background
poller may repeat forever, and each iteration may retry forever on failure. That
creates nested unbounded recurrence: the outer loop never ends, and the inner
failure path also has no budget. Backoff can make the damage slower, but it does
not create an escape hatch.

## Why it is risky

The risk is not just wasted CPU. A background loop without interruption can keep
resources alive after their owner is gone: connections, subscriptions, queue
leases, cache handles, tenant state, and fibers. If the loop performs external
work, it can continue sending requests after the feature was disabled or after
the caller timed out.

An unbounded loop also hides failure. If every error is logged and the loop
continues, the system may look available while doing no useful work. If failures
are retried forever, the final error never reaches a caller and the only visible
symptom may be delayed shutdown, growing logs, repeated downstream traffic, or a
slow increase in background fibers.

Budgets matter because time and attempts are operational commitments. Without a
budget, a loop can spend unlimited time reconnecting, refreshing, polling, or
reconciling. Without concurrency and queue limits, it can accumulate more work
than the system can drain. Without observability, operators cannot distinguish a
healthy idle loop from a stuck loop, a loop making progress from one repeating
the same failure, or one instance from hundreds synchronized on the same
cadence.

## A better approach

Design the loop as a managed process, then choose the schedule. Give every
background loop a lifecycle owner and make interruption part of the design. If
the loop belongs to a request, tenant, lease, subscription, or service scope, it
should stop when that owner stops. If it is process-level infrastructure, it
should participate in shutdown and expose enough state to be supervised.

Add explicit recurrence limits where failure is possible. Use count limits such
as `Schedule.recurs` or `Schedule.take` when an operation only deserves a fixed
number of retries or repeats. Use time budgets such as `Schedule.during` when
the operation may wait for a condition but should not wait forever. Use
`Schedule.while` when the schedule must stop based on schedule metadata such as
attempt, elapsed time, input, output, or selected delay.

Keep the forever part narrow. It can be reasonable for an outer service loop to
repeat for the lifetime of the service, but inner recovery loops should still
have budgets. A cache refresher may run for the service lifetime, while one
refresh attempt has a small retry policy. A reconnecting client may be owned by a
scope, while each connection attempt has bounded backoff. A poller may continue
while the subscription is active, while each poll has a timeout and clear
handling for terminal states.

Make observability part of the schedule boundary. `Schedule.tapInput` and
`Schedule.tapOutput` are useful places to record retry inputs, recurrence counts,
selected delays, and other schedule outputs. Metrics and logs should answer at
least these questions: how many loops are running, when did each last make
progress, how many consecutive failures has it seen, what delay is it using, and
which owner or tenant is responsible for it.

## Notes and caveats

A loop that is intended to run for the whole process lifetime can still use an
unbounded schedule. The requirement is not "never use `Schedule.forever`". The
requirement is that forever has an owner, an interruption path, bounded failure
handling inside the loop, and production signals that show whether it is doing
useful work.

Do not rely on jitter as the escape hatch. `Schedule.jittered` spreads recurrence
delays, which helps when many instances might synchronize, but it does not stop
a loop, cap its work, or report that it is unhealthy. Jitter is a load-shaping
tool, not a lifecycle, budget, or observability policy.
