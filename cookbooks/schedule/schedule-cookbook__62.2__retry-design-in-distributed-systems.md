---
book: Effect `Schedule` Cookbook
section_number: "62.2"
section_title: "Retry design in distributed systems"
part_title: "Part XIV — Reference Appendices"
chapter_title: "62. Further Reading"
status: "draft"
code_included: false
---

# 62.2 Retry design in distributed systems

This further-reading entry connects distributed retry concerns to the
`Schedule` primitives used throughout the cookbook.

## What this section is about

Distributed retry design is not a new primitive and not only a timing problem.
It is a contract between the caller, the downstream system, and every other
caller that may observe the same failure. A retry policy should answer five
questions before choosing a delay curve:

- Is the operation safe to run more than once?
- Which failures are retryable, and which should stop immediately?
- How quickly should pressure decrease when the dependency is unhealthy?
- How much total retry work is allowed?
- What happens when many clients retry at the same time?

`Schedule` describes the local recurrence policy. The distributed-system
design still has to decide whether recurrence is allowed, how much additional
load it may create, and where shared limits live.

## Why it matters

Retries can turn one failure into many requests. A policy that looks harmless
inside one process can become a synchronized wave across a fleet when a shared
database, broker, cache, or API starts failing. Backoff reduces pressure over
time, but it does not make duplicate side effects safe. Jitter spreads timing,
but it does not enforce quotas. Count and time budgets stop local retry loops,
but they do not replace server-side rate limits, load shedding, or
backpressure.

The purpose of a retry schedule is therefore not to "try harder." It is to make
the extra work explicit and bounded.

## Core idea

Start with safety, then choose timing, then add bounds.

| Design concern | Schedule connection | Distributed-system reading |
| --- | --- | --- |
| Duplicate side effects | Classify before retrying; use an input-aware stop condition when the failure says "do not retry" | A schedule cannot supply idempotency. Use idempotency keys, compare-and-set writes, deduplication, or transactional boundaries before retrying unsafe operations. |
| Temporary overload or unavailability | `Schedule.exponential(base, factor)` | Increasing delays reduce pressure after repeated failure. In `Schedule.ts`, the first delay is the base duration and the default factor is `2`. |
| Constant low-risk retry pace | `Schedule.spaced(duration)` | Use a fixed gap when the downstream can tolerate a steady retry rate and failures are not a sign of overload. |
| Wall-clock cadence | `Schedule.fixed(interval)` | Use fixed intervals only when alignment to time boundaries is the real requirement; it is not the usual shape for failure recovery. |
| Fleet synchronization | `Schedule.jittered` | Jitter randomly adjusts each selected delay between 80% and 120% of the original delay, spreading clients that would otherwise retry together. |
| Attempt budget | `Schedule.recurs(n)` or `Schedule.take(n)` | Bound the maximum number of extra calls. Backoff changes delay; it does not stop by itself. |
| Elapsed-time budget | `Schedule.during(duration)` | Stop once the caller no longer benefits from more retries, even if the attempt count has not been reached. |
| Multiple limits must all apply | `Schedule.both` | Intersection-style composition continues only while both schedules continue and uses the larger delay, which is usually the conservative retry composition. |
| Provider-specific timing | `Schedule.unfold` with delay modification such as `Schedule.addDelay` or `Schedule.modifyDelay` | Model retry-after windows, quota resets, or protocol-specific delay curves directly instead of hiding them behind generic exponential backoff. |

## Practical guidance

Treat idempotency as the first retry decision. Reads and naturally idempotent
writes can often retry with ordinary timing. Non-idempotent writes need a
separate safety mechanism: a stable request identifier, a deduplicating
receiver, an atomic state transition, or a compensating workflow. If none of
those exists, a schedule only repeats the risk.

Choose backoff when repeated failure may mean overload. `Schedule.exponential`
is the normal starting point for remote calls, reconnects, and dependency
checks because it quickly reduces request pressure. Pair it with
`Schedule.recurs`, `Schedule.take`, `Schedule.during`, or a classification rule
so the retry does not continue indefinitely.

Add jitter for shared failure domains. If many fibers, processes, containers,
or client devices are likely to see the same error at the same time,
deterministic backoff can synchronize them. `Schedule.jittered` should be
applied after the base delay policy is chosen. It spreads retries; it does not
change which errors are safe or how much total work is allowed.

Budget retries from the caller's point of view and from the downstream's point
of view. A user-facing request may need a short elapsed budget and a small
attempt count. A background repair loop may tolerate a longer budget but should
still protect the dependency with spacing, backoff, and shared throttles. The
right question is the maximum extra load the system may add while it is already
unhealthy.

Respect explicit downstream signals. Authorization failures, validation
errors, permanent configuration errors, and exhausted quotas should usually
stop or move to a different control path. Rate-limit responses and
retry-after-style responses should shape the next delay according to the
provider's contract, not according to a generic local curve.

Keep local schedules and shared controls separate. `Schedule` is a precise way
to describe one caller's recurrence behavior. Distributed systems still need
server-side rate limits, queue backpressure, circuit breakers, load shedding,
and admission control when the protected capacity is shared.
