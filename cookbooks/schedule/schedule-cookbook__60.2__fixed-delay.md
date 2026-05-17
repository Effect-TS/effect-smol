---
book: Effect `Schedule` Cookbook
section_number: "60.2"
section_title: "Fixed delay"
part_title: "Part XIV — Reference Appendices"
chapter_title: "60. Index by Pattern"
status: "draft"
code_included: false
---

# 60.2 Fixed delay

Fixed delay is the steady recurrence pattern for policies that should not grow,
shrink, or adapt over time.

Use this entry to choose between "wait after each run" and "stay on a fixed
cadence". Both are steady policies, but they answer different operational
requirements.

## What this section is about

The direct `Schedule` constructors are:

- `Schedule.spaced(duration)` recurs continuously with each repetition spaced by the given duration from the last run.
- `Schedule.fixed(interval)` recurs on a fixed interval and outputs the repetition count so far.

Both schedules are unbounded unless you combine them with a limit such as `Schedule.take`, `Schedule.recurs`, `Schedule.during`, or a condition such as `Schedule.recurWhile`.

## Why it matters

A fixed delay is often the simplest policy that can be defended in production. It is predictable, easy to explain, and easy to observe. It is a good fit when the operation is low risk, the downstream service can tolerate steady traffic, and the goal is clarity rather than adaptive load shedding.

The main risk is choosing the wrong kind of fixed delay. `Schedule.spaced("5 seconds")` waits five seconds after a run completes before the next run. `Schedule.fixed("5 seconds")` tries to keep a five-second cadence. If the action takes longer than the interval, `fixed` runs the next action immediately, but missed runs do not pile up.

## Core idea

Choose `Schedule.spaced` when the requirement is:

- retry after a small, constant pause
- poll only after the previous check has completed
- leave a quiet period between background jobs
- avoid immediate tight loops while keeping behavior simple

Choose `Schedule.fixed` when the requirement is:

- run periodic work on a regular cadence
- sample, flush, check, or refresh at an interval measured from the schedule clock
- keep the intended rate visible even when individual runs are shorter or longer

If the policy is a retry policy, remember that the first attempt is not delayed by the schedule. The schedule controls the waits between retries after failures. If the policy is a repeat policy, the first successful run happens before the schedule controls the next recurrence.

## Practical guidance

Use fixed delay for simple, bounded, operationally predictable work:

- lightweight idempotent retries against a dependency that usually recovers quickly
- predictable polling for job status, payment status, cache availability, or readiness
- steady background loops such as maintenance, queue draining, metrics flushing, and health checks
- user-facing workflows where a short constant pause is easier to reason about than exponential backoff

Add a count or elapsed-time limit when the loop must eventually stop. Add jitter when many clients or workers could otherwise synchronize on the same delay. Prefer exponential backoff or another increasing schedule when repeated failure means the downstream system may be overloaded.

Do not build fixed delay indirectly with lower-level composition when one constructor states the policy. `Schedule.spaced("1 second")` is the reference shape for "wait one second after each run." `Schedule.fixed("1 second")` is the reference shape for "run on a one-second cadence."
