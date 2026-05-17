---
book: Effect `Schedule` Cookbook
section_number: "52.3"
section_title: "Poll user-facing status too often"
part_title: "Part XII — Anti-Patterns"
chapter_title: "52. Polling Too Aggressively"
status: "draft"
code_included: false
---

# 52.3 Poll user-facing status too often

## The anti-pattern

A user-facing status check is treated as if the shortest interval is the best
interval. A job page, checkout flow, report export, deployment view, identity
verification screen, or support timeline gets a tight repeat policy because the
UI should feel live.

`Schedule.spaced("250 millis")`, `Schedule.fixed("1 second")`, or a similar
policy can be valid. The problem is a cadence that does not match the product
promise, expected state-change rate, or user's deadline. A fast loop may keep a
spinner looking active, but each poll still wakes a fiber and usually touches a
remote service, database, queue, or control plane.

This often appears as a shared "poll status" helper used by many screens. A
payment authorization, video transcoding job, background import, and long-lived
review process all inherit the same fast loop even though their natural
cadences are different.

## Why it happens

UI feedback is designed before the operational budget. Developers want to reduce
uncertainty for the user, so the loop is made faster instead of making the state
model clearer. A rapidly refreshed "pending" message can feel easier than
deciding when to slow down, stop automatic refresh, or move the user to an
asynchronous notification path.

Local testing also sets bad defaults. A short interval makes a demo progress
quickly. In production, the same interval may run across thousands of browser
tabs, mobile clients, server-side sessions, or workers waiting on user-visible
state.

## Why it is risky

The first risk is waste. A status endpoint that returns "pending" ninety-nine
times before returning "complete" has still consumed request capacity, database
reads, cache lookups, logs, metrics, and client battery for each pending answer.
When the status belongs to a slow workflow, fast polling mostly measures
impatience.

The second risk is user-facing distortion. Too-frequent refreshes can make a
slow process look stuck because the UI keeps proving that nothing changed. They
can also create flicker, repeated announcements for assistive technology,
unstable progress indicators, and confusing transitions when intermediate
states are shown before they are meaningful.

Another risk is incident amplification. If the downstream system is delayed,
every waiting client may keep asking for status at the moment the system most
needs breathing room. A fast user-facing poll loop can become a feedback loop:
slow processing creates more pending users, more pending users create more
polls, and more polls make the processing path harder to recover.

The missing product deadline matters too. After some time, the UI should change
behavior: slow down, offer notification, show a stable pending state, ask the
user to return later, or surface a timeout message.

## A better approach

Choose the cadence from the user experience and the backend cost, not from the
desire to make the UI feel busy. For short-lived status changes where the user
is actively waiting, use an initial cadence that is quick enough to feel
responsive but still plausible for the workflow. For longer work, slow the
cadence after the first few checks or start with a wider interval.

Use `Schedule.spaced` when the intended contract is "wait this long after each
status check before checking again." Use `Schedule.fixed` only when alignment to
a regular interval is the desired behavior; the source implementation keeps a
fixed interval and, when work runs behind, the next run can happen immediately
rather than accumulating missed runs. That is rarely the default a status page
needs.

Make the deadline visible in the policy. If the UI should only poll during a
short active-wait window, combine the cadence with `Schedule.take`,
`Schedule.recurs`, or `Schedule.during`. In the Schedule source, `Schedule.take`
limits the wrapped schedule by recurrence attempt count, and `Schedule.during`
continues only while elapsed time remains within the supplied duration.

After the active-wait window, switch behavior intentionally. The next phase may
use a slower `Schedule.spaced` cadence, ask the server for a recommended next
check time, move to push notifications, or stop automatic polling and show a
stable message. If many users may wait on the same dependency, add
`Schedule.jittered` after choosing a reasonable base cadence so clients do not
refresh in lockstep; the implementation randomly adjusts each computed delay
between 80% and 120% of the original delay.

Name schedules after the experience they provide:
`pollCheckoutStatusWhileWaiting`, `refreshExportStatusSlowlyAfterFirstMinute`,
or `checkVerificationUntilHandoffDeadline`. Names like `fastPoll` hide who is
waiting, for how long, and at what cost.

## Notes and caveats

Fast user-facing polling is sometimes correct. A short payment handoff,
same-page authentication challenge, local device pairing flow, or brief
readiness check may need a tight cadence for a bounded period. The important
word is bounded: make the active-wait deadline part of the schedule or the
surrounding workflow.

Do not use polling frequency as the only way to communicate progress. If the
backend can report phases, estimated completion windows, retry-after guidance,
or a terminal pending state, those signals usually produce a calmer interface
than refreshing the same status more often.

`Schedule` controls recurrence. It can space checks, keep fixed intervals,
limit recurrence count, stop after elapsed time, and jitter delays. It cannot
decide the user's patience, the downstream budget, or the product deadline.
Those decisions should be explicit before the status loop is attached.
