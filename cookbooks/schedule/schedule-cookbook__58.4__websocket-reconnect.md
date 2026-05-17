---
book: Effect `Schedule` Cookbook
section_number: "58.4"
section_title: "WebSocket reconnect"
part_title: "Part XIV — Reference Appendices"
chapter_title: "58. Index by Problem"
status: "draft"
code_included: false
---

# 58.4 WebSocket reconnect

Use this reference when a user-visible WebSocket drops and reconnect timing must
balance fast recovery, service pressure, and a clear offline boundary.

After a disconnect, the policy needs product-facing boundaries, not just a loop.
The useful question is not "how do I retry forever?" but "how quickly should the
user see recovery, and when should the UI stop treating recovery as imminent?"

The usual starting point is `Schedule.exponential`, because immediate repeated
reconnect attempts can amplify outages. `Schedule.exponential(base, factor)`
produces delays using `base * factor^(attempt - 1)`, with a default factor of
`2`. That fits the common reconnect shape: try soon, then back away as the
outage persists.

WebSocket failures are often correlated. A deploy, network flap, proxy restart,
or regional incident can disconnect many clients at once. If all clients
reconnect on the same deterministic delay sequence, they can create synchronized
load exactly when the server is least able to absorb it.

Reconnect is also part of the product experience. A chat, dashboard,
collaborative editor, or trading screen should usually show a short
"reconnecting" phase, then a clear degraded or offline state if the connection
does not return. The schedule should encode that boundary instead of hiding it
in scattered UI timers.

## Core idea

Model WebSocket reconnect as an exponential backoff policy with desynchronization and a visible cap.

Use `Schedule.exponential` for the increasing delay. Pick a low base delay when
fast recovery matters, such as reconnecting after a brief mobile network
interruption. Use a gentler factor when the UI should remain responsive without
hammering the service.

Apply `Schedule.jittered` when many clients may reconnect together. It randomly
adjusts each recurrence delay between 80% and 120% of the original delay, which
spreads reconnect attempts without changing the broad backoff shape.

Add a cap. For a count cap, use `Schedule.recurs` or `Schedule.take` with the
reconnect schedule. For an elapsed-time cap, combine the reconnect schedule with
`Schedule.during`. `Schedule.both` continues only while both schedules continue
and uses the maximum delay, so combining an exponential policy with
`Schedule.recurs` or `Schedule.during` gives a bounded retry window without
making the reconnect cadence faster.

If the reconnect delay itself must stop growing after a maximum interval, clamp
the delay with `Schedule.modifyDelay`. There is no separate capped-exponential
constructor in `Schedule.ts`; the cap is an explicit delay modification layered
on the base schedule.

## Practical guidance

For foreground user interfaces, prefer a short, eager first phase and a clear
transition to offline or manual retry. A reconnect policy that keeps retrying
silently for minutes can make the application feel broken even if it is
technically still retrying.

For background or durable clients, longer retry windows are reasonable, but
still use jitter and maximum delays. A background reconnect loop should protect
the service during outages and expose enough status for observability.

Avoid using `Schedule.spaced` as the primary reconnect policy unless the service
explicitly wants a constant cadence. Constant spacing is simpler, but it does
not reduce pressure as an outage lengthens. Reserve it for heartbeats or
polling-style checks where every interval has the same meaning.

A defensible WebSocket reconnect policy usually reads as: exponential backoff
for increasing waits, jitter to avoid synchronized clients, a count or elapsed
cap to define the user-visible recovery window, and an optional maximum delay
clamp for long-running background reconnect loops.
