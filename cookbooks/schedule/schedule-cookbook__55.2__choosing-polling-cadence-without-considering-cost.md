---
book: Effect `Schedule` Cookbook
section_number: "55.2"
section_title: "Choosing polling cadence without considering cost"
part_title: "Part XII — Anti-Patterns"
chapter_title: "55. Ignoring Operational Context"
status: "draft"
code_included: false
---

# 55.2 Choosing polling cadence without considering cost

Polling cadence is an operational-cost decision. In Effect, a `Schedule` makes
recurrence explicit, but the interval still has to match the resources, quotas,
and lifetime of the workflow.

## The anti-pattern

The mistake is choosing the polling interval from user experience alone: "check
every second so the UI feels fresh" or "poll quickly so jobs finish as soon as
possible." The code then applies that cadence without asking how many callers
will use it, how long they can keep polling, or what the downstream service can
tolerate.

This usually appears as a simple fixed or spaced repeat policy that is copied
between workflows. The cadence is visible, but the cost model is absent. There
is no per-request budget, no fleet-level estimate, no connection to dependency
quotas, and no distinction between a brief request-scoped poller and a
long-lived background monitor.

## Why it happens

It happens because local polling feels cheap. A single request every second is
easy to ignore during development, and `Schedule.spaced("1 second")` describes
that local behavior clearly. The missing calculation is multiplication:
callers, resources, polling frequency, and worst-case duration.

The abstraction can hide pressure because it reads like control flow instead of
capacity planning. `Schedule.spaced` waits the configured duration after each
run. `Schedule.fixed` targets regular interval boundaries and does not pile up
missed runs. Neither constructor knows the price of a status check, the number
of instances in the fleet, or the dependency's read quota. Those facts belong
in the policy around the schedule.

## Why it is risky

Polling cost scales with fleet size. One caller polling every second is one
request per second. Five hundred callers polling every second is five hundred
requests per second before retries, page refreshes, deploy overlap,
autoscaling, or synchronized wakeups are counted. If each poll reads several
rows, calls another service, or emits telemetry, the real cost is higher than
the visible interval suggests.

Aggressive polling can add pressure exactly when dependencies are least
able to absorb it. A stuck job runner, slow control plane, delayed payment
provider, or degraded search index causes pollers to keep seeing non-terminal
states. Without a budget, the fleet continues spending dependency capacity on
observations that are unlikely to change soon.

The business cost is easy to miss. Some providers bill per request. Some
internal systems have shared quotas. Some endpoints are backed by databases
whose read capacity must be reserved for user traffic. A polling cadence that
feels responsive can consume the same budget that protects writes, interactive
reads, or incident recovery.

## A better approach

Start with an explicit budget, then choose the cadence. Estimate the worst-case
request rate from the number of concurrent pollers, the intended interval, and
the maximum polling window. Compare that number with the dependency's capacity,
rate limits, provider quota, and cost model. If the estimate is not acceptable,
the schedule is wrong even if each individual caller behaves correctly.

Use `Schedule.spaced` when the contract is "wait this long after each
successful observation." Use `Schedule.fixed` only when fixed timing boundaries
are part of the requirement. Add `Schedule.during`, `Schedule.recurs`, or
`Schedule.take` so a caller cannot poll indefinitely. Combine cadence and budget
with `Schedule.both` when both must continue. The polling loop should also stop
when the observed status is terminal; that domain decision belongs in the
repeated effect, not in the cadence alone.

When many callers may run the same cadence, add jitter if exact timing is not
required. In Effect, `Schedule.jittered` adjusts each recurrence delay between
80% and 120% of the delay produced by the wrapped schedule. That does not make
polling cheaper, but it can prevent many pollers from concentrating their cost
on the same boundary.

Name the policy after the budget it promises, not only the interval it uses.
`orderStatusPollForTwoMinutes` communicates more than `pollEverySecond`: it
invites review of both the timeout and the implied request volume.

## Notes and caveats

Fast polling is sometimes correct. Short-lived interactive workflows, local
coordination loops, and cheap in-memory checks can justify a tight cadence when
the scope is bounded and the dependency can afford it. The anti-pattern is not
"polling quickly"; it is choosing the interval without pricing the total load.

Do not rely on jitter as the budget. Jitter spreads recurrence timing, but it
does not cap total requests, enforce provider quotas, or decide when polling is
no longer useful. Use admission control, server-side rate limits, backpressure,
or push-based notifications when the dependency needs stronger protection than
a client-side schedule can provide.
