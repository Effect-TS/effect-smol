---
book: Effect `Schedule` Cookbook
section_number: "59.3"
section_title: "Avoid synchronized retries"
part_title: "Part XIV — Reference Appendices"
chapter_title: "59. Index by Operational Goal"
status: "draft"
code_included: false
---

# 59.3 Avoid synchronized retries

Use this index when many callers may retry or poll the same dependency at the
same time. The risk is phase alignment: independent fibers, processes, workers,
hosts, or browser tabs compute the same future retry windows after seeing the
same outage, restart, cache miss, quota response, or deploy event.

## Why it matters

Exponential backoff reduces pressure over time, but identical callers still
retry at identical exponential delays: 100 milliseconds, 200 milliseconds, 400
milliseconds, and so on. Fixed and spaced retries have the same problem when
callers start in the same window.

Synchronization can slow outage recovery, exhaust shared quotas, create broker
reconnect storms, overload control planes, and turn metrics into periodic
spikes instead of a smooth load curve.

## Core schedule choices

- Use `Schedule.jittered(schedule)` to randomize each computed delay. In Effect,
  jitter keeps the same schedule output and changes only the next sleep.
- Start from `Schedule.exponential` for transient dependency failures, then add
  `Schedule.jittered` and a retry limit such as `Schedule.recurs` or
  `Schedule.take`.
- Use jittered `Schedule.spaced` for polling or background loops where exact
  cadence is not required.
- Avoid `Schedule.fixed` as the base when desynchronization is the main goal.
  `fixed` is chosen to preserve interval cadence, which can preserve alignment.
- Add `Schedule.during` when the retry window must stay inside an elapsed
  budget.

`Schedule.jittered` adjusts selected delays to a random value between 80% and
120% of the original delay. It does not change which errors are retryable, how
many recurrences are allowed, or when the schedule stops.

## Related recipes

Use [8.2 Add jitter to exponential backoff](schedule-cookbook__08.2__add-jitter-to-exponential-backoff.md)
for the standard retry shape: backoff first, then jitter, then limits.

Use [27.2 Jittered retries for Redis reconnects](schedule-cookbook__27.2__jittered-retries-for-redis-reconnects.md)
or [27.4 Jittered retries for brokers and queues](schedule-cookbook__27.4__jittered-retries-for-brokers-and-queues.md)
when many processes may reconnect after a shared dependency outage.

Use [19.1 Polling from many clients without synchronization](schedule-cookbook__19.1__polling-from-many-clients-without-synchronization.md)
or [19.5 Reduce herd effects in control planes](schedule-cookbook__19.5__reduce-herd-effects-in-control-planes.md)
when recurrence is polling rather than retrying after failure.

Use [24.1 Backoff for unstable remote APIs](schedule-cookbook__24.1__backoff-for-unstable-remote-apis.md),
[24.3 Backoff for broker recovery](schedule-cookbook__24.3__backoff-for-broker-recovery.md),
or [7.4 Capped backoff for worker processes](schedule-cookbook__07.4__capped-backoff-for-worker-processes.md)
when jitter also needs increasing delays, caps, or retry budgets.

Use [55.4 Forgetting that many instances may run the same schedule](schedule-cookbook__55.4__forgetting-that-many-instances-may-run-the-same-schedule.md)
when the main issue is the fleet multiplier itself.

## Caveats

Treat jitter as a phase-spreading tool, not as a safety boundary. It reduces the
chance that many callers retry in the same instant, but it does not reduce total
retry volume, enforce a quota, or make non-idempotent operations safe.

Always pair synchronized-retry mitigation with a stopping rule. `Schedule.jittered`
changes delays; it does not decide when to stop. Use `Schedule.recurs`,
`Schedule.take`, elapsed budgets, predicates at the retry boundary, or
domain-specific failure classification so the policy cannot retry forever by
accident.

Design against the shared dependency's limit, not only the local caller. A
fleet-aware policy may need lower local retry counts, slower base delays, queue
admission, central rate limiting, lease ownership, partitioning, or
server-provided retry delays in addition to jitter.

Do not use jitter where exact timing is the contract. Heartbeats, leases,
protocol windows, billing periods, maintenance windows, and exact-delay tests
may need deterministic schedules or explicit coordination instead of randomness.
