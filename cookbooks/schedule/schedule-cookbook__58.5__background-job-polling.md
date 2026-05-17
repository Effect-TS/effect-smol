---
book: Effect `Schedule` Cookbook
section_number: "58.5"
section_title: "Background job polling"
part_title: "Part XIV — Reference Appendices"
chapter_title: "58. Index by Problem"
status: "draft"
code_included: false
---

# 58.5 Background job polling

Use this reference when a submitted job completes later and the caller must poll
status without overloading the status endpoint.

Frame exports, imports, media processing, indexing, provisioning, ETL runs, and
similar workflows as "how should I poll this job status?" rather than "how
should I retry this failing call?"

The closest full recipes are [17.2 Poll every 5 seconds for up to 2 minutes](schedule-cookbook__17.2__poll-every-5-seconds-for-up-to-2-minutes.md),
[17.3 Give up when the operation is clearly too slow](schedule-cookbook__17.3__give-up-when-the-operation-is-clearly-too-slow.md),
and [46.1 Poll ETL status until completion](schedule-cookbook__46.1__poll-etl-status-until-completion.md).
Related entries are [36.4 Stop when data becomes available](schedule-cookbook__36.4__stop-when-data-becomes-available.md),
[48.4 Surface termination reasons](schedule-cookbook__48.4__surface-termination-reasons.md),
and [52.2 Poll large fleets in sync](schedule-cookbook__52.2__poll-large-fleets-in-sync.md).

A background job can finish successfully, fail permanently, be canceled, remain
queued, or keep running past the caller's patience. Those are domain states,
not transport failures. Treating them as ordinary successful observations keeps
the schedule focused on recurrence: whether another poll is allowed, when it
should happen, and when the polling budget has been spent.

Keep three concerns separate:

- the status predicate decides whether the latest successful status is still
  pollable
- the interval decides how much load each active job places on the status API
- the timeout or budget decides when this workflow stops waiting

With `Effect.repeat`, a failed status read stops the polling loop unless the
read effect has its own retry policy. With `Schedule.during`, the elapsed
duration is a recurrence budget checked between polls; it is not a timeout for
a status read already in flight.

## Core idea

Model polling as a status-valued repeat:

- use `Schedule.spaced(interval)` when each next poll should wait for the
  interval after the previous status read completes
- use `Schedule.fixed(interval)` when polls should target fixed time boundaries
- use `Schedule.passthrough` when the repeated effect should return the latest
  observed job status instead of the schedule's timing output
- use `Schedule.while(({ input }) => isActive(input))` to continue only while
  the latest successful status remains non-terminal
- use `Schedule.during(duration)`, `Schedule.recurs(n)`, or `Schedule.take(n)`
  to bound the number or elapsed lifetime of recurrence decisions
- use `Schedule.bothLeft` or `Schedule.both` when the interval and the budget
  must both continue allowing another poll
- use `Schedule.jittered` for many background workers polling the same control
  plane, when exact alignment is not required

The usual shape is "spaced polling AND still active AND still inside budget".
If the final observed status is still active, the schedule budget ended before
the job reached a terminal state. Surrounding Effect code should translate that
into a domain result such as "still running", "timed out waiting", or "resume in
background".

## Practical guidance

Choose the status predicate first. For statuses such as `queued`, `running`,
`succeeded`, `failed`, and `canceled`, polling should usually continue for
`queued` and `running`, then stop for terminal states. Do not turn terminal job
failures into effect failures inside the polling loop unless every caller wants
the repeat to fail at that point.

Choose the interval from operational load, not from a test's happy path. A
foreground workflow might poll every one or five seconds under a short
`Schedule.during` budget. A background reconciler might poll every 30 seconds or
every few minutes, often with jitter, because aggregate status traffic matters
more than one job's perceived latency.

Choose timeout vocabulary carefully. `Schedule.during("2 minutes")` limits how
long the repeat schedule keeps allowing another status check. It does not
interrupt the current HTTP call, database read, or SDK request. If each status
read needs its own deadline, apply `Effect.timeout` to that read effect and keep
the schedule budget as the recurrence policy.

Prefer returning or inspecting the last observed status after polling. That lets
callers distinguish "the job failed", "the job was canceled", "the status read
failed", and "the polling budget ended while the job was still active". Those
states require different user messages, logs, metrics, and follow-up behavior.
