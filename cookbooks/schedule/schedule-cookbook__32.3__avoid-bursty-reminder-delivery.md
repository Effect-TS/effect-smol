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

Reminder cadence should be a product rule, not an accident of how fast a worker
can drain a backlog.

## Problem

A reminder worker may have several follow-ups ready to send. Draining them as
fast as possible can make one user receive messages back-to-back or make the
provider see a burst that resembles spam.

The policy should state the minimum gap between deliveries and the maximum
number of follow-ups.

## When to use it

Use this for reminder flows where repeated delivery is intended but must be
paced: appointment reminders, onboarding nudges, payment notices, and pending
approval reminders.

It is useful when product, support, or compliance teams need a rule such as
"send at most two follow-ups, at least ten minutes apart."

## When not to use it

Do not use a local schedule as your only protection for provider-wide or
tenant-wide quotas. Shared quotas need shared state, provider feedback, queue
partitioning, or a rate limiter.

Do not repeat unsafe sends blindly. If the provider accepted the previous
reminder but the acknowledgement was lost, another send can duplicate a
user-visible message.

## Schedule shape

Use `Schedule.spaced(duration)` for a pause after each successful send. Combine
it with `Schedule.recurs(n)` to cap follow-ups. Add `Schedule.jittered` when
many workers may start together; it randomizes delays between 80% and 120% of
the base delay.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type Reminder = {
  readonly reminderId: string
  readonly userId: string
}

type ReminderStep =
  | { readonly _tag: "Delivered"; readonly reminder: Reminder; readonly remaining: number }
  | { readonly _tag: "Done" }

const dueReminders: Array<Reminder> = [
  { reminderId: "reminder-1", userId: "user-123" },
  { reminderId: "reminder-2", userId: "user-123" },
  { reminderId: "reminder-3", userId: "user-123" }
]

const deliverNextReminder = Effect.gen(function*() {
  const reminder = dueReminders.shift()

  if (reminder === undefined) {
    yield* Console.log("no reminders due")
    return { _tag: "Done" } as const
  }

  yield* Console.log(`delivered ${reminder.reminderId} to ${reminder.userId}`)
  return { _tag: "Delivered", reminder, remaining: dueReminders.length } as const
})

const reminderCadence = Schedule.spaced("20 millis").pipe(
  Schedule.both(Schedule.recurs(2)),
  Schedule.jittered
)

const program = deliverNextReminder.pipe(
  Effect.repeat({
    schedule: reminderCadence,
    while: (step) => step._tag === "Delivered" && step.remaining > 0
  })
)

Effect.runPromise(program)
```

The demo sends three intended reminders with short gaps. A production cadence
would use product limits such as minutes or hours.

## Variants

For stricter user-facing behavior, increase spacing and lower the recurrence
count. For provider quotas, choose spacing from the provider's window and keep
the provider or delivery log as the final authority.

Omit jitter for a single worker when predictable timing matters. Keep jitter
for multiple workers or many users created at the same time.

## Notes and caveats

`Effect.repeat` feeds successful deliveries into the schedule. Failed sends are
not retried by this policy; use a separate `Effect.retry` policy for transient
provider failures.

`Schedule.spaced` waits after each completed run. Use `Schedule.fixed` only
when wall-clock interval boundaries are the requirement.

The schedule does not decide whether a user should receive a reminder. Keep
opt-outs, quiet hours, deduplication, and per-user quota checks near delivery.
