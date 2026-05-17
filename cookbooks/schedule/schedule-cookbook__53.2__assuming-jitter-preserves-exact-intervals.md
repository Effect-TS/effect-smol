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

`Schedule.jittered` changes intervals; it does not decorate an exact cadence.
This section focuses on code that keeps exact-interval assumptions after jitter
has been applied.

## The anti-pattern

The problematic version starts with a schedule whose name or surrounding
domain implies precision, then pipes it through `Schedule.jittered` while still
treating the result as exact. A five-second heartbeat is still described as
"every five seconds". A poller is still documented as running on a fixed
interval. A lease renewal loop is still sized as though every delay will be the
base delay.

The code may look harmless because the original schedule is still visible:
`Schedule.spaced("5 seconds").pipe(Schedule.jittered)` still starts from a
five-second delay. The mistake is assuming the starting delay remains the
observable cadence. Once jitter is applied, each recurrence may be earlier or
later than the base interval; in Effect, that means a random value between
`80%` and `120%` of the wrapped delay.

## Why it happens

It usually happens because jitter is discussed as a resilience feature. That is
accurate for retry storms, reconnect loops, and fleets of workers that would
otherwise wake at the same time. The mental shortcut is to treat jitter as a
small improvement that leaves the underlying cadence intact.

`Schedule` values describe timing policy. Adding `Schedule.jittered` changes
that policy from "wait exactly this delay" to "wait somewhere in this bounded
range". For a deterministic schedule, that is not decoration. It is a semantic
change.

## Why it is risky

The main risk is breaking code that was designed around exact spacing. A
heartbeat that can run late may trip a peer's timeout. A renewal loop that can
wait 20% longer than expected may lose part of its safety margin. A sampling
loop that can run early or late no longer produces evenly spaced measurements.

The failure mode is easy to miss because jitter stays close to the original
delay. Most recurrences may look normal in logs, while the occasional later
delay is enough to violate a protocol, confuse a user-visible countdown, or
make a virtual-time test depend on randomness instead of exact advancement.

There is also a documentation risk. If an operator, product surface, or test
fixture says "every 10 seconds", a jittered schedule no longer implements that
promise. The base interval is only the center of the range, not the exact
interval the program will observe.

## A better approach

Keep exact-cadence schedules unjittered. Use `Schedule.fixed` when work should
follow a fixed cadence, `Schedule.spaced` when each run should be separated by
a stable gap, and deterministic backoff when predictable retry timing matters.
Add explicit bounds such as `Schedule.recurs`, `Schedule.take`, or
`Schedule.during` independently from the decision to jitter.

Use `Schedule.jittered` only when moving individual intervals is acceptable and
useful. It is appropriate when the goal is to reduce synchronized load from
many clients, service instances, or workers. In those cases, the interval
variation is the feature, not an implementation detail.

Make the tradeoff visible in names and comments. A name like
`exactPollingInterval` should not hide a jittered schedule. A name like
`jitteredReconnectBackoff` communicates that exact intervals are not part of
the contract.

## Notes and caveats

Jitter does not change how many recurrences are allowed, which errors are
retryable, or whether the repeated work is safe. It changes the delay selected
for each recurrence. If exact timing is required, leaving jitter out is the
correct design, not a missing resilience feature.
