---
book: Effect `Schedule` Cookbook
section_number: "60.4"
section_title: "Capped backoff"
part_title: "Part XIV — Reference Appendices"
chapter_title: "60. Index by Pattern"
status: "draft"
code_included: false
---

# 60.4 Capped backoff

Use this index for retry and reconnect policies that grow more conservative at
first but enforce a maximum single delay. The policy should read as: retry soon,
then back away, but never sleep longer than this cap between attempts.

## API mapping

The usual base is `Schedule.exponential(base, factor)`, which computes delays
from the base duration and growth factor. Apply the cap with
`Schedule.modifyDelay`.

`Schedule.modifyDelay` receives the schedule output and the computed delay for
the next recurrence. It returns the delay that should actually be used. For a
capped exponential policy, return `Duration.min(delay, cap)`. Delays below the
cap keep the exponential shape; delays above the cap are replaced by the maximum
duration.

## How to choose

Build capped backoff in layers:

- Use `Schedule.exponential` when the delay should grow by a factor from one
  recurrence to the next.
- Apply `Schedule.modifyDelay` when the computed delay must be transformed
  before sleeping.
- Use `Duration.min` inside `modifyDelay` when the transformation is a hard
  maximum delay.
- Add `Schedule.recurs` or `Schedule.take` when the policy needs a retry-count
  limit.
- Add `Schedule.during` when the policy needs an elapsed-time budget.
- Add `Schedule.jittered` when many callers may retry together, then decide
  deliberately whether the hard cap should apply before or after jitter.

For a strict maximum actual wait, apply the final cap after any jitter. If the
policy is capped first and then jittered, `Schedule.jittered` can raise a delay
above the original cap because it adjusts delays between 80% and 120% of the
value it receives.

`Schedule.modifyDelay` changes the delay used for recurrence; it does not
change the schedule output. If metrics or logs need to report the capped delay,
derive that value explicitly instead of assuming the raw output of
`Schedule.exponential` is the slept duration.

## Related recipes

Use [25.5 Cap delays without losing backoff benefits](schedule-cookbook__25.5__cap-delays-without-losing-backoff-benefits.md)
for exponential backoff, `Schedule.modifyDelay`, `Duration.min`, and a separate
retry-count limit.

Use [49.5 Test capped backoff behavior](schedule-cookbook__49.5__test-capped-backoff-behavior.md)
when the cap is part of the contract and tests must verify the computed delays.

Use [44.5 Reconnect WebSocket with jitter](schedule-cookbook__44.5__reconnect-websocket-with-jitter.md)
when a reconnect loop also needs desynchronization across clients.

Use [58.4 WebSocket reconnect](schedule-cookbook__58.4__websocket-reconnect.md)
for the reference view of backoff, jitter, caps, and recovery windows.

Use [59.4 Bound total retry time](schedule-cookbook__59.4__bound-total-retry-time.md)
when the more important cap is the whole retry window rather than one sleep.

## Caveats

Use capped backoff for transient, retry-safe failures where early recovery is
common but unbounded tail delays would hide the failure. It fits idempotent HTTP
calls, control-plane requests, broker reconnects, startup probes, and background
workers that should reduce pressure without disappearing for too long.

Do not use capped backoff to retry permanent failures. Validation errors,
authorization failures, malformed requests, missing configuration, and unsafe
non-idempotent writes should be classified before the schedule is applied.

Do not use capped backoff when a fixed cadence is the real contract. If every
retry should wait exactly the same duration, use `Schedule.spaced`.

Choose the cap from the workflow budget, not from the shape of the curve. A
foreground request may need a cap measured in hundreds of milliseconds or a few
seconds. A background reconnect loop can often tolerate a larger cap, but it
still needs visible count, time, or status boundaries so operators can
understand what happens after recovery does not arrive quickly.
