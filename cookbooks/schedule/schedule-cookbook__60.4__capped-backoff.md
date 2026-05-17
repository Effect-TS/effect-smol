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

Capped backoff is a reference-index entry for retry and reconnect policies that
grow more conservative at first but enforce a maximum single delay.

## What this section is about

The policy should read as "retry soon, then back away, but never wait longer
than this cap between attempts." The usual base is
`Schedule.exponential(base, factor)`, which computes delays from the base
duration and a growth factor. The cap is then applied with
`Schedule.modifyDelay`.

`Schedule.modifyDelay` receives the schedule output and the computed delay for
the next recurrence. It returns the delay that should actually be used. For a
capped exponential policy, return `Duration.min(delay, cap)`. Delays below the
cap keep the exponential shape; delays above the cap are replaced by the maximum
duration.

## Why it matters

An uncapped exponential backoff can drift into waits that are too long for the
caller, operator, or worker that owns the workflow. A policy that starts at
`250 millis` can eventually produce waits measured in minutes if it is allowed
to grow without a maximum.

Capping the delay makes the operational contract easier to review. The policy
still reduces pressure during the early failure window, but the retry loop
cannot become quieter than the workflow allows. That distinction is different
from a retry count cap or elapsed-time cap: a capped backoff limits each
individual sleep. It should usually be combined with `Schedule.recurs`,
`Schedule.take`, or `Schedule.during` so the whole retry policy is bounded too.

## Core idea

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
above the original cap because it randomly adjusts delays between 80% and 120%
of the value it receives.

`Schedule.modifyDelay` changes the delay used for recurrence; it does not
change the schedule output. If metrics or logs need to report the capped delay,
derive that value explicitly instead of assuming the raw output of
`Schedule.exponential` is the slept duration.

## Recipe index

Use section 25.5, "Cap delays without losing backoff benefits", for the primary
recipe: exponential backoff, `Schedule.modifyDelay`, `Duration.min`, and a
separate retry-count limit.

Use section 49.5, "Test capped backoff behavior", when the delay cap is part of
the contract and you need deterministic tests for the computed recurrence
delays.

Use section 44.5, "Reconnect WebSocket with jitter", when the capped backoff is
part of a reconnect loop and the policy also needs desynchronization across
clients.

Use section 58.4, "WebSocket reconnect", for the reference-index view of
backoff, jitter, caps, and user-visible recovery windows.

Use section 59.4, "Bound total retry time", when the more important cap is the
whole retry window rather than the maximum delay between two attempts.

## Practical guidance

Use capped backoff for transient, retry-safe failures where early recovery is
common but unbounded tail delays would hide the failure. It fits idempotent HTTP
calls, control-plane requests, broker reconnects, startup probes, and background
workers that should reduce pressure without disappearing for too long.

Do not use capped backoff to retry permanent failures. Validation errors,
authorization failures, malformed requests, missing configuration, and unsafe
non-idempotent writes should be classified before the schedule is applied.

Do not use capped backoff when a fixed cadence is the real contract. If every
retry should wait exactly the same duration, use `Schedule.spaced` rather than
building an exponential schedule and clamping most of its values.

Choose the cap from the workflow budget, not from the shape of the curve. A
foreground request may need a cap measured in hundreds of milliseconds or a few
seconds. A background reconnect loop can often tolerate a larger cap, but it
still needs visible count, time, or status boundaries so operators can
understand what happens after recovery does not arrive quickly.
