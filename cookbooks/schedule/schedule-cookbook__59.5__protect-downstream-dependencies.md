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

Protect downstream dependencies is a reference-index entry for `Schedule`
recipes that keep recurrence pressure within another system's capacity.

## What this section is about

Use this entry when recurrence can add load to a system you do not fully
control: HTTP retries, database reconnects, queue polling, webhook delivery,
cache refreshes, background workers, provider API calls, and startup readiness
checks.

The useful question is not "how do I retry longer?" It is "what traffic can this
policy add while the dependency is already slow, unhealthy, throttling, or
quota-limited?"

## Why it matters

Retries and repeats can multiply downstream traffic. A local retry policy that
looks modest in one process can become a fleet-wide burst when many callers see
the same failure. A tight polling loop can compete with user-facing work. A
generic backoff can ignore a provider's explicit rate-limit or quota signal.

`Schedule` makes the recurrence policy visible, but the policy still has to
encode the downstream contract: how fast calls may arrive, which failures are
safe to retry, how long pressure may continue, and whether many clients need to
be desynchronized.

## Core idea

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
| Multiple limits must all hold | `Schedule.both` | It continues only while both schedules continue and uses the larger delay, which is usually the conservative overload-protection composition. |
| Some errors must not retry | `Schedule.while` or retry classification before scheduling | Stop before timing is considered for validation errors, authorization failures, quota exhaustion, unsafe writes, and other non-retryable classes. |

## Practical guidance

For rate limits, start from the downstream contract. If the provider gives a
reset time or retry window, model that timing explicitly instead of treating the
response like an ordinary transient failure. `Schedule.spaced` is useful for a
steady local allowance; `Schedule.modifyDelay` is useful when the next delay
must be derived from a classified response or capped after another schedule has
chosen a delay.

For overloaded services, prefer backoff plus limits. `Schedule.exponential`
reduces pressure after repeated failures, but it is unbounded by itself. Combine
it with `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or an
input-aware stop condition so the retry policy has a visible end.

For shared fleets, add jitter after choosing the base cadence. `Schedule.jittered`
does not make an unsafe retry safe and does not enforce a quota. It only spreads
the selected delays, so classification and limits still need to be present.

For classification, decide whether the next call is allowed before asking when
it should happen. Retryable transport failures, temporary unavailability, and
capacity throttles can use conservative timing. Validation errors,
authorization failures, permanent configuration errors, quota exhaustion, and
non-idempotent side effects should usually stop or move to a different control
path.

For strict protection, prefer intersection-style composition. `Schedule.both`
keeps the policy running only while both sides continue and selects the maximum
delay. That makes it a good fit for "retry with backoff, but only within this
count or time budget." Avoid compositions that extend traffic longer than the
downstream contract allows.

Client-side schedules reduce retry and polling pressure, but they are not a
replacement for server-side rate limits, queues, backpressure, circuit breakers,
bulkheads, or load shedding. Use `Schedule` to make each caller's recurrence
honest; use shared controls when the downstream limit is shared.
