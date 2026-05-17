---
book: Effect `Schedule` Cookbook
section_number: "59.5"
section_title: "Protect downstream dependencies"
part_title: "Part XIV — Reference Appendices"
chapter_title: "59. Index by Operational Goal"
status: "draft"
code_included: false
---

# 59.5 Protect downstream dependencies

Use this index when recurrence can add load to a downstream dependency: a
service, database, queue, cache, provider API, broker, or control plane that
receives calls from your program. The policy should state what traffic is still
acceptable while that dependency is slow, unhealthy, throttling, or
quota-limited.

## Why it matters

Retries and repeats multiply downstream traffic. A modest local policy can
become a fleet-wide burst when many callers see the same failure. A tight
polling loop can compete with user-facing work. A generic backoff can ignore a
provider's explicit rate-limit or quota signal.

`Schedule` makes the recurrence policy visible, but the policy still has to
encode the downstream contract: how fast calls may arrive, which failures are
safe to retry, how long pressure may continue, and whether many clients need to
be desynchronized.

## Core schedule choices

Map the protection goal to the smallest schedule shape that states the
constraint clearly.

| Downstream risk | Prefer | Why |
| --- | --- | --- |
| Provider or service needs a steady gap between calls | `Schedule.spaced` | It waits the chosen duration between recurrences, which is the plainest way to avoid a tight loop. |
| Work must align to wall-clock windows | `Schedule.fixed` | It recurs on fixed intervals, but if work runs longer than the interval the next run may be immediate, so use it only when alignment is the real contract. |
| Repeated failures mean the dependency is unhealthy | `Schedule.exponential` | It increases delay after each recurrence. It does not stop by itself, so pair it with a limit. |
| A quota or protocol requires a custom delay curve | `Schedule.unfold` plus `Schedule.addDelay`, or `Schedule.modifyDelay` | Use a named custom curve or delay rewrite when local exponential backoff would hide the downstream rule. |
| Many callers may retry together | `Schedule.jittered` | It adjusts each delay to a random value between 80% and 120% of the incoming delay, spreading the fleet without changing the stop condition. |
| Every extra call has cost | `Schedule.recurs` or `Schedule.take` | Use count limits when the maximum number of additional attempts is part of the protection contract. |
| Calls stop being useful after a deadline | `Schedule.during` | Use an elapsed budget when the downstream should not keep receiving retries after the caller no longer benefits. |
| Multiple limits must all hold | `Schedule.both` | It continues only while both schedules continue and uses the larger delay, which is usually the conservative protection shape. |
| Some errors must not retry | `Schedule.while` or `Effect.retry({ while })` | Stop before timing is considered for validation errors, authorization failures, unsafe writes, and other non-retryable classes. |

## Practical guidance

For rate limits, start from the downstream contract. If the provider gives a
reset time or retry window, model that timing explicitly instead of treating the
response like an ordinary transient failure. Use `Schedule.spaced` for a steady
local allowance and `Schedule.modifyDelay` when a classified response must
rewrite the next delay.

For overloaded services, prefer backoff plus limits. `Schedule.exponential`
reduces pressure after repeated failures, but it is unbounded by itself. Combine
it with `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or an
input-aware stop condition so the retry policy has a visible end.

For shared fleets, add jitter after choosing the base cadence. `Schedule.jittered`
spreads selected delays; it does not enforce a quota or make unsafe retries
safe.

For classification, decide whether the next call is allowed before asking when
it should happen. Retryable transport failures, temporary unavailability, and
capacity throttles can use conservative timing. Validation errors,
authorization failures, permanent configuration errors, quota exhaustion, and
unsafe side effects should usually stop or move to a different control path.

For strict protection, prefer intersection-style composition with
`Schedule.both`: "retry with backoff, but only within this count or time budget."
Avoid compositions that extend traffic longer than the downstream contract
allows.

Client-side schedules reduce retry and polling pressure, but they are not a
replacement for server-side rate limits, queues, backpressure, circuit breakers,
bulkheads, or load shedding. Use `Schedule` to make each caller's recurrence
honest; use shared controls when the downstream limit is shared.
