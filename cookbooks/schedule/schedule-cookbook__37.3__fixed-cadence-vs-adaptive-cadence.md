---
book: "Effect `Schedule` Cookbook"
section_number: "37.3"
section_title: "Fixed cadence vs adaptive cadence"
part_title: "Part X — Choosing the Right Recipe"
chapter_title: "37. Decision Matrix by Problem Shape"
status: "draft"
code_included: false
---

# 37.3 Fixed cadence vs adaptive cadence

Use this matrix when the main question is whether work should run on a
predictable cadence or slow down in response to repeated failure, contention, or
uncertainty. `Schedule.fixed` and `Schedule.spaced` express steady cadence.
`Schedule.exponential`, `Schedule.fibonacci`, `Schedule.modifyDelay`, and
`Schedule.jittered` express adaptive behavior.

## Decision matrix

| Problem shape | Prefer | Why | Guardrails |
| --- | --- | --- | --- |
| Health checks, metric flushes, cache refreshes, or maintenance work that should stay aligned to a regular interval | `Schedule.fixed(interval)` | It targets fixed interval boundaries. If work overruns the interval, the next recurrence can be immediate, but missed runs are not replayed. | Add `Schedule.jittered` when many instances start together. Add `Schedule.take`, `Schedule.recurs`, or `Schedule.during` when the cadence is temporary. |
| Worker loops where each completed item should be followed by a pause | `Schedule.spaced(duration)` | It waits after each action completes. Long-running work naturally pushes the next run later. | Use this for politeness and load smoothing. Add count or elapsed limits for bounded workflows. |
| Retrying transient failures against a dependency that may be overloaded | `Schedule.exponential(base, factor)` or `Schedule.fibonacci(base)` | The delay grows as failures continue, reducing pressure on the dependency. | Combine with `Schedule.recurs`, `Schedule.take`, or `Schedule.during`. Add `Schedule.jittered` for fleet-wide retries. |
| Retrying rate limits, quota responses, or service-specific overload signals | Adaptive backoff with `Schedule.modifyDelay` or a stateful schedule | The next delay should reflect the service signal, not only a local interval. | Respect server-provided retry hints when available. Cap the maximum delay if user experience or job latency matters. |
| Polling a known external state transition | Start with `Schedule.spaced(duration)` | Polling is easier to reason about when every completed observation is followed by the same pause. | Switch to adaptive polling only if early responsiveness matters or later polling should become less frequent. Stop on terminal status. |
| Reconnecting clients, brokers, sockets, or control-plane calls after failure | Backoff plus jitter | Fast repeated reconnects can amplify an incident. Adaptive delay gives the remote system room to recover. | Add a maximum delay, a maximum attempt count, and jitter for many clients. |

## Fixed cadence choices

`Schedule.fixed` and `Schedule.spaced` are both fixed-delay tools, but they
answer different operational questions.

- Choose `Schedule.fixed` when the desired shape is "run on this clock-like
  interval." It fits recurring work that should remain aligned to interval
  boundaries.
- Choose `Schedule.spaced` when the desired shape is "after each completion,
  wait this long." It fits work where action duration should push the next
  recurrence later.

The overrun behavior is the key difference. With `fixed`, slow work can be
followed by an immediate recurrence, while skipped intervals are not replayed.
With `spaced`, the delay is applied after the action completes, so overruns slow
the cadence automatically.

## Adaptive cadence choices

Adaptive cadence is the better default when each repeated failure is evidence
that the next attempt should be more conservative. `Schedule.exponential` grows
by multiplying a base delay by the configured factor for each recurrence.
`Schedule.fibonacci` grows more gradually. `Schedule.modifyDelay` can clamp or
otherwise change the computed delay. `Schedule.jittered` randomizes each delay
between 80% and 120% of the current delay to reduce synchronization.

Use adaptive policies for retries more often than for ordinary periodic work. A
fixed cadence says, "this work is expected and routine." Backoff says, "the
system is failing or unavailable, so each new attempt should be less
aggressive."

## Selection rules

- If the work is routine and expected to succeed, start with `Schedule.fixed` or `Schedule.spaced`.
- If the repeated action is a retry after failure, start with backoff unless the dependency is local, cheap, and known to recover quickly.
- If action duration should not shift the intended wall-clock cadence, use `Schedule.fixed`.
- If action duration should naturally slow the loop, use `Schedule.spaced`.
- If many clients can execute the same schedule at the same time, add jitter before relying on either fixed or adaptive timing.
- If the workflow has user-visible latency, add explicit attempt or elapsed-time limits instead of allowing long adaptive tails to grow invisibly.

## Common mistakes

- Using `Schedule.fixed` for slow work and being surprised by immediate follow-up runs after overruns.
- Using `Schedule.spaced` when operators expect a wall-clock cadence such as "every minute."
- Using a fixed retry delay against an overloaded remote service, which can keep pressure constant when pressure should decrease.
- Adding exponential backoff to routine polling without a reason, which can make normal progress look sluggish.
- Forgetting jitter in a fleet, where identical fixed or adaptive policies can synchronize across instances.
