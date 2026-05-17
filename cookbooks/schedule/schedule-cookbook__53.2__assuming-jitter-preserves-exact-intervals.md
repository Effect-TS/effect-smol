---
book: Effect `Schedule` Cookbook
section_number: "53.2"
section_title: "Assuming jitter preserves exact intervals"
part_title: "Part XII — Anti-Patterns"
chapter_title: "53. Misusing Jitter"
status: "draft"
code_included: false
---

# 53.2 Assuming jitter preserves exact intervals

`Schedule.jittered` changes intervals. It does not keep an exact cadence and add
randomness somewhere else.

## Anti-pattern

A schedule whose name or domain implies precision is piped through
`Schedule.jittered`, then still documented as exact. A heartbeat is called
"every five seconds". A poller is described as fixed interval. A lease renewal
loop is sized as if every delay will equal the base delay.

The original schedule may still be visible in the expression, but the observable
policy has changed. In Effect, each jittered delay is selected between `80%` and
`120%` of the wrapped delay. The base interval becomes the center of a range,
not the exact wait.

## Why it happens

Jitter is often described as a resilience feature, which is accurate for retry
storms, reconnect loops, and fleets of workers that would otherwise wake at the
same time. The shortcut is treating it as a harmless improvement that preserves
the underlying cadence.

`Schedule` values describe timing policy. Adding `Schedule.jittered` changes
that policy from "wait this delay" to "wait somewhere in this bounded range".
For deterministic schedules, that is a semantic change.

## Why it is risky

Exact-spacing code can break quietly. A heartbeat that runs late may trip a
peer timeout. A renewal loop that waits 20% longer than expected may lose its
safety margin. A sampling loop that runs early or late no longer produces evenly
spaced measurements.

The failure can be hard to spot because jitter stays near the original delay.
Most recurrences may look normal, while an occasional later delay is enough to
violate a protocol, confuse a countdown, or make a virtual-time test depend on
randomness.

There is also a documentation problem. If an operator guide, product surface, or
test fixture says "every 10 seconds", a jittered schedule no longer implements
that promise.

## A better approach

Keep exact-cadence schedules unjittered. Use `Schedule.fixed` when work should
follow a fixed interval, `Schedule.spaced` when each run should wait a stable
gap after the previous run, and deterministic backoff when predictable retry
timing matters. Add bounds with `Schedule.recurs`, `Schedule.take`, or
`Schedule.during`; bounds and jitter solve different problems.

Use `Schedule.jittered` only when moving individual intervals is acceptable and
useful. It is appropriate when reducing synchronized load from many clients,
service instances, or workers matters more than preserving each caller's exact
interval.

Make the tradeoff visible in names and comments. A name like
`exactPollingInterval` should not hide a jittered schedule. A name like
`jitteredReconnectBackoff` communicates that exact intervals are not part of
the contract.

## Caveats

Jitter does not change how many recurrences are allowed, which errors are
retryable, or whether the repeated work is safe. It changes the delay selected
for each recurrence. If exact timing is required, leaving jitter out is the
correct design, not a missing resilience feature.
