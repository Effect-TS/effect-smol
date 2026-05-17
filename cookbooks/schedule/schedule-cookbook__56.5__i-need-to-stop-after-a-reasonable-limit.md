---
book: Effect `Schedule` Cookbook
section_number: "56.5"
section_title: "“I need to stop after a reasonable limit”"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "56. Recipe Selection Guide"
status: "draft"
code_included: false
---

# 56.5 “I need to stop after a reasonable limit”

Use this entry when a retry, repeat, poll, or background loop needs a clear
stopping boundary.

## What this section is about

This entry is about selecting the first guardrail, not tuning the delay curve. Ask what makes the next recurrence unreasonable:

- Too many attempts: use `Schedule.recurs`.
- Too many outputs from an existing schedule: use `Schedule.take`.
- Too much elapsed time: use `Schedule.during`.
- A schedule output says the work has reached a boundary: use an output predicate with `Schedule.while`.

That decision should be made before adding backoff, spacing, jitter, or logging.

## Why it matters

An unbounded schedule is easy to write and hard to defend. A retry that can continue forever can hide a failing dependency. A poller without a time budget can make a user-facing workflow hang. A background loop without a count, time, or output boundary can turn a temporary condition into persistent load.

Reasonable limits also make reviews easier. The reader should be able to tell whether the policy stops because it exhausted attempts, exceeded a wall-clock budget, consumed enough outputs, or observed a domain-specific output.

## Core idea

Use the limit that matches the thing you are protecting.

Use `Schedule.recurs` when the policy itself is just “try again up to this many times.” In `Schedule.ts`, `recurs(times)` is a schedule that can only be stepped the specified number of times before it terminates, and it outputs the recurrence count. This is the clearest choice for retry ceilings such as “at most three retries.”

Use `Schedule.take` when you already have a schedule shape and want to cap how many outputs it may produce. This is usually the right fit for limiting `Schedule.spaced`, `Schedule.fixed`, `Schedule.exponential`, `Schedule.fibonacci`, or another composed schedule without changing its cadence semantics.

Use `Schedule.during` when the defensible boundary is elapsed time. `during(duration)` recurs only while the elapsed duration remains within the supplied duration. It is the right primitive for “retry for up to 30 seconds,” “poll during startup,” or “keep sampling during a short diagnostic window.”

Use an output predicate when the schedule output carries the boundary. The exported predicate combinator is `Schedule.while`, whose predicate receives schedule metadata including `output`, `attempt`, `elapsed`, and `duration`. Reach for this when the output has meaning, such as a counter, an accumulated value, a state-machine state, or a measured delay, and stopping depends on that value rather than on a fixed count or clock budget.

## Practical guidance

Prefer one primary stop condition and add a second only when it protects a different failure mode. For example, a retry policy might use increasing delays and still cap attempts with `Schedule.recurs`, or a poller might use a cadence plus `Schedule.during` so it cannot wait forever.

Do not choose `Schedule.recurs` and `Schedule.take` as interchangeable names for the same thought. `recurs` is itself the count-based schedule. `take` limits another schedule after you have chosen its cadence or output behavior.

When the limit is operational, make it visible in the recipe name or surrounding code: attempts, outputs, elapsed time, or output predicate. If nobody can say which one stopped the schedule, the policy is too hard to operate.
