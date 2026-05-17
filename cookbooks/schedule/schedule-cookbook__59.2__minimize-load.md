---
book: Effect `Schedule` Cookbook
section_number: "59.2"
section_title: "Minimize load"
part_title: "Part XIV — Reference Appendices"
chapter_title: "59. Index by Operational Goal"
status: "draft"
code_included: false
---

# 59.2 Minimize load

Use this index when the main budget is load: the aggregate work added by
retries, polling, or background recurrence. The policy should reduce pressure on
callers, runtimes, and downstream systems while still giving transient
conditions a bounded chance to recover.

For retries, `Effect.retry` consults the schedule only after a typed failure.
For polling or repetition, `Effect.repeat` runs once and then asks the schedule
whether and when to run again. In both cases, the schedule controls recurrence;
the surrounding Effect code still decides which failures or states are safe to
repeat.

## Core schedule choices

- Use `Schedule.spaced(duration)` when each recurrence should wait after the
  previous run completes. This is usually the clearest low-load shape for
  polling and maintenance loops.
- Use `Schedule.fixed(interval)` only when wall-clock cadence matters. If a run
  takes longer than the interval, the next recurrence can be immediate.
- Use `Schedule.exponential(base, factor)` when repeated failure should slow the
  caller down.
- Use `Schedule.unfold` with `Schedule.addDelay` when the delay curve is
  domain-specific and should not be hidden behind exponential backoff.
- Use `Schedule.jittered` when many callers may compute the same delay. Effect
  jitters each selected delay to a random value between 80% and 120%.
- Use `Schedule.modifyDelay` when a computed delay must be rewritten, for
  example to enforce a maximum.
- Use `Schedule.recurs`, `Schedule.take`, or `Schedule.during` for visible count
  and elapsed-time budgets.
- Use `Schedule.both` when multiple constraints must all hold. It continues only
  while both schedules continue and uses the larger delay.

Avoid `Schedule.either` for load protection unless the longer-lived union is
intentional. It continues while either schedule continues and uses the smaller
delay, which usually spends more capacity.

## Related recipes

Use [18.2 Slow polling after initial responsiveness matters less](schedule-cookbook__18.2__slow-polling-after-initial-responsiveness-matters-less.md)
when a workflow can start responsive and then settle into a slower background
cadence.

Use [21.3 Linear backoff](schedule-cookbook__21.3__linear-backoff.md) when
failures should slow down by a predictable fixed increment.

Use [24.5 Backoff for cloud control plane calls](schedule-cookbook__24.5__backoff-for-cloud-control-plane-calls.md)
when a quota-protected API needs backoff, jitter, caps, and retry budgets.

Use [58.2 Temporary database unavailability](schedule-cookbook__58.2__temporary-database-unavailability.md)
when retry storms could slow database recovery.

Use [59.3 Avoid synchronized retries](schedule-cookbook__59.3__avoid-synchronized-retries.md)
when the main risk is many callers retrying at the same times.

Use [59.4 Bound total retry time](schedule-cookbook__59.4__bound-total-retry-time.md)
when elapsed budget matters more than retry count.

Use [59.5 Protect downstream dependencies](schedule-cookbook__59.5__protect-downstream-dependencies.md)
when the load budget belongs to a service, database, queue, or provider.

## Caveats

Minimize aggregate work, not just per-call delay. A retry that waits one second
can still be too aggressive if thousands of workers retry together. Increase
spacing, add jitter, lower concurrency outside the schedule, or move the work to
a queue when the downstream system needs recovery time.

Do not spend retry budget on permanent failures: validation errors,
authorization failures, malformed requests, missing configuration, or unsafe
non-idempotent writes.

Delay caps keep long-tail waits predictable, but a cap is not a stopping rule.
Pair caps with count limits, elapsed budgets, or domain predicates. For
background workers, make exhaustion observable through logs, metrics,
dead-letter queues, or domain state.
