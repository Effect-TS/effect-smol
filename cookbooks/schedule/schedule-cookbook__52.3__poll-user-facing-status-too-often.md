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

Polling user-facing status too often is an anti-pattern because it confuses
responsiveness with constant checking.

## The anti-pattern

The problematic version treats a user-facing status check as if the shortest
possible interval is automatically the best interval. A job detail page,
checkout flow, report export, deployment view, identity verification screen, or
support ticket timeline gets a tight repeat policy because the UI should feel
"live."

The schedule may be technically valid. `Schedule.spaced("250 millis")`,
`Schedule.fixed("1 second")`, or a similar policy can describe repeated checks.
The issue is that the cadence does not match the product promise, the expected
state-change rate, or the user's deadline. It updates the transport more often
than it updates useful information: a fast loop may keep a spinner or progress
bar looking alive, but each poll still wakes a fiber and usually touches a
remote service, database, queue, or control plane.

This often appears as a shared "poll status" helper used by many screens. A
payment authorization, video transcoding job, background import, and long-lived
review process all inherit the same fast loop even though their natural
cadences are different.

## Why it happens

It usually happens when UI feedback is designed before the operational budget.
Developers want to remove uncertainty for the user, so the loop is made faster
instead of making the state model clearer. A rapidly refreshed "still pending"
message can feel easier than deciding when to show "this is taking longer than
usual", when to stop automatic refresh, or when to move the user to an
asynchronous notification path.

It also happens when local testing sets the cadence. A short interval makes a
demo progress from pending to complete quickly. In production, the same interval
may run across thousands of open browser tabs, mobile clients, server-side
sessions, or workers waiting on user-visible state.

`Schedule` makes the recurrence explicit, but it does not decide what freshness
the user needs. That decision has to come from the workflow: how often the state
can change, how quickly the user can act on a change, how expensive each check
is, and what deadline the user experience should communicate.

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

The third risk is incident amplification. If the downstream system is delayed,
every waiting client may keep asking for status at the moment the system most
needs breathing room. A fast user-facing poll loop can become a feedback loop:
slow processing creates more pending users, more pending users create more
polls, and more polls make the processing path harder to recover.

The fourth risk is a missing product deadline. A loop that keeps refreshing
quickly can hide the real decision: after some time, the UI should change
behavior. The correct response may be to slow down, offer to notify the user,
show a stable pending state, ask them to return later, or surface a timeout
message rather than continuing to ask the same question aggressively.

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
rather than accumulating missed runs. That can be useful, but it is rarely what
a user-facing status page needs by default.

Make the deadline visible in the policy. If the UI should only poll during a
short active-wait window, combine the cadence with `Schedule.take`,
`Schedule.recurs`, or `Schedule.during`. In the Schedule source, `Schedule.take`
limits the wrapped schedule by recurrence attempt count, and `Schedule.during`
continues only while elapsed time remains within the supplied duration. Those
bounds make it reviewable that the UI will not keep aggressively refreshing
forever.

After the active-wait window, switch behavior intentionally. The next phase may
use a slower `Schedule.spaced` cadence, ask the server for a recommended next
check time, move to push notifications, or stop automatic polling and show a
stable message. If many users may wait on the same dependency, add
`Schedule.jittered` after choosing a reasonable base cadence so clients do not
refresh in lockstep; the implementation randomly adjusts each computed delay
between 80% and 120% of the original delay.

Name schedules after the experience they provide: "poll checkout status while
the user is waiting", "refresh export status slowly after the first minute", or
"check verification result until the handoff deadline." Names like "fast poll"
or "live status" hide the questions that matter: who is waiting, for how long,
and at what cost.

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
