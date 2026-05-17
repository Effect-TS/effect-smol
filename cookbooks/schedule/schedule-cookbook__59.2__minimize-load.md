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

Minimize load is a reference-index entry for `Schedule` recipes that reduce
recurrence pressure on callers, runtimes, and downstream systems.

## What this section is about

Use load-minimizing scheduling when repeated work can amplify an outage,
exhaust a quota, saturate a shared dependency, or compete with user-facing
traffic. The schedule should answer three questions before another attempt or
poll happens: how long to wait, how quickly to slow down, and where the policy
must stop.

This entry applies to retries and polling. For retries, `Effect.retry` runs the
effect once and consults the schedule only after a typed failure. For polling
with `Effect.repeat`, the first observation runs once and the schedule controls
later observations. In both cases, the schedule describes recurrence; the
surrounding Effect code still decides which failures or states are safe to
repeat.

## Why it matters

Repeated work multiplies load. A fast retry policy from one fiber may be cheap,
but the same policy across many fibers, processes, or regions can create a
retry wave exactly when a dependency is degraded. Polling has the same shape: a
small interval can become a steady background tax when multiplied by tenants,
resources, or worker counts.

Load minimization is therefore not just "sleep longer." It is a production
contract: space ordinary recurrence, back off after failures, desynchronize
callers, cap extreme delays, and stop after an explicit count or elapsed-time
budget.

## Core idea

Start with the load source and choose the smallest schedule shape that makes it
bounded:

- Use `Schedule.spaced(duration)` when each recurrence should wait after the
  previous run completes. This is the usual low-load shape for polling and
  background maintenance because work duration naturally stretches the cadence.
- Use `Schedule.fixed(interval)` only when the operation should target regular
  interval boundaries. In `Schedule.ts`, fixed schedules do not pile up missed
  executions, but a long run can make the next recurrence happen immediately.
  That can be correct for heartbeats and clocks, but it is not always the
  lowest-load choice.
- Use `Schedule.exponential(base, factor)` for failure backoff. It produces an
  increasing delay curve from the attempt number, which reduces request rate as
  failures persist.
- Use `Schedule.unfold` with `Schedule.addDelay` when the backoff curve is
  custom, such as linear growth or a domain-specific sequence.
- Use `Schedule.jittered` when many callers may compute the same delay. In
  `Schedule.ts`, jitter adjusts each recurrence delay to a random value between
  80% and 120% of the original delay, spreading retries and polls across time.
- Use `Schedule.modifyDelay` to apply a hard maximum delay when the tail must
  remain predictable. Apply the cap after jitter if randomization must never
  exceed the operational bound.
- Use `Schedule.recurs(n)` or `Schedule.take(n)` for count budgets, and
  `Schedule.during(duration)` for elapsed-time budgets.
- Combine the timing policy with budgets using `Schedule.both` when all
  constraints must remain true. `Schedule.both` recurs only while both schedules
  recur and uses the maximum delay between them, which is the conservative
  shape for lowering load.

Avoid `Schedule.either` for load protection unless the longer-lived union is
intentional. It continues while either schedule continues and uses the minimum
delay, which usually spends more capacity than a load-minimizing policy should.

## Recipe index

Use section 18.2, "Slow polling after initial responsiveness matters less",
when a workflow can start responsive and then settle into a slower background
cadence.

Use section 21.3, "Linear backoff", when failures should slow down by a
predictable fixed increment instead of an exponential curve.

Use section 24.5, "Backoff for cloud control plane calls", when a shared,
quota-protected API needs bounded exponential backoff, jitter, a hard delay
cap, and retry budgets.

Use section 35.5, "Balance responsiveness and persistence", when user-facing
work should have a short foreground budget and longer background retries should
carry the load.

Use section 58.2, "Temporary database unavailability", when retry storms could
make a recovering database worse and the policy needs backoff, jitter, and
explicit stop conditions.

Use section 59.3, "Avoid synchronized retries", when the main risk is many
clients retrying at the same computed times.

Use section 59.4, "Bound total retry time", when the load policy should be
governed by an elapsed budget rather than only by retry count.

Use section 59.5, "Protect downstream dependencies", when the load concern is
not local CPU or latency, but protecting another service, database, queue, or
provider.

## Practical guidance

Minimize aggregate work, not just per-call delay. A retry that waits one second
may still be too aggressive if thousands of workers retry together. Increase
spacing, add jitter, lower concurrency outside the schedule, or fail into a
queue when the downstream system needs recovery time.

Use backoff for transient failures, not permanent ones. Validation errors,
authorization failures, malformed requests, missing configuration, and
non-idempotent writes that cannot be safely repeated should fail without
spending a retry budget.

Keep budgets visible. Count budgets protect the dependency from unbounded
attempts. Elapsed budgets protect callers and queues from invisible waiting.
Delay caps keep long-tail behavior predictable, but a cap is not a stopping
rule; pair it with `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or a
domain predicate.

For user-facing paths, prefer short budgets and visible failure over long
background waiting. For background workers, longer budgets can be appropriate,
but exhaustion should be observable through logs, metrics, dead-letter queues,
or domain state so operators can distinguish "still retrying" from "stuck."
