---
book: Effect `Schedule` Cookbook
section_number: "32.3"
section_title: "Avoid bursty reminder delivery"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "32. Space User-Facing Side Effects"
status: "draft"
code_included: true
---

# 32.3 Avoid bursty reminder delivery

Reminder systems can become noisy when a worker drains a backlog as fast as
possible. A user who missed one message might suddenly receive several
follow-ups, or a provider might see a sharp burst that looks like spam. Model
the delivery cadence as a `Schedule` so the spacing and quota are visible in
one place.

## Problem

You need to send follow-up reminders without delivering them back-to-back. The
policy should answer two operational questions directly:

- how much time must pass between reminder deliveries
- how many follow-up deliveries are allowed

The first delivery still happens when the effect is run. The schedule controls
only later successful recurrences.

## When to use it

Use this recipe for user-facing reminder flows where repeated delivery is
allowed but must be paced: appointment reminders, onboarding nudges, payment
notices, or pending approval reminders. It is especially useful when product,
support, or compliance teams need a clear cap such as "send at most two
follow-ups, at least ten minutes apart."

## When not to use it

Do not use a local schedule as your only protection for a provider-wide or
tenant-wide quota. A schedule spaces one repeated effect. Global quotas still
need shared state, provider feedback, queue partitioning, or a rate limiter.

Also avoid repeating unsafe sends blindly. If the provider accepted the reminder
but the acknowledgement was lost, retries can duplicate a user-visible message.
Use idempotency keys or delivery records before adding recurrence.

## Schedule shape

Use `Schedule.spaced(duration)` when the important rule is a pause after each
successful send. Pair it with `Schedule.recurs(n)` to cap the number of
follow-up sends. `Schedule.both` keeps both rules: the schedule recurs only
while both policies allow it, and it uses the longer delay when they disagree.

Add `Schedule.jittered` when many workers may start together. In Effect,
`jittered` adjusts each delay to a random value between 80% and 120% of the
base delay, which helps avoid synchronized reminder waves.

## Code

```ts
import { Effect, Schedule } from "effect"

type ReminderDeliveryError = {
  readonly _tag: "ProviderUnavailable" | "RateLimited"
}

type ReminderReceipt = {
  readonly reminderId: string
  readonly userId: string
}

declare const deliverReminder: Effect.Effect<
  ReminderReceipt,
  ReminderDeliveryError
>

const reminderCadence = Schedule.spaced("10 minutes").pipe(
  Schedule.both(Schedule.recurs(2)),
  Schedule.jittered
)

export const program = Effect.repeat(deliverReminder, reminderCadence)
```

The first `deliverReminder` run is not delayed. After a successful delivery,
the schedule waits roughly ten minutes before the next delivery. Because the
schedule also includes `Schedule.recurs(2)`, it allows at most two scheduled
follow-ups after the original run.

## Variants

For a stricter user-facing policy, use a longer spacing such as
`Schedule.spaced("1 hour")` and a smaller recurrence count. This reduces the
chance that a temporarily unreachable user receives a cluster of reminders when
delivery resumes.

For a provider quota, choose spacing from the quota window, not from worker
throughput. If the provider allows one reminder per user every fifteen minutes,
make the local cadence at least that large and keep the provider or delivery
log as the final authority.

For a small, single-worker queue where predictable timing matters more than
fleet smoothing, omit `Schedule.jittered`. For multiple workers or many users
created at the same time, keep the jitter so reminders do not align into
minute-boundary bursts.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. Failed sends are not
turned into follow-up reminders by this policy; handle provider failures with a
separate retry policy if you need one.

`Schedule.spaced` waits after each completed run. If a send takes thirty
seconds and the spacing is ten minutes, the next send starts about ten minutes
after the previous send completes. Use `Schedule.fixed` only when the wall-clock
interval itself is the requirement.

A schedule can make reminder spacing explicit, but it does not decide whether a
specific user should receive a reminder. Keep opt-out checks, quiet hours,
deduplication, and per-user quota checks near the delivery effect.
