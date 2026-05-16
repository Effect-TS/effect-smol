---
book: Effect `Schedule` Cookbook
section_number: "57.2"
section_title: "Immediate responsiveness vs infrastructure safety"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "57. Decision Matrix by Problem Shape"
status: "draft"
code_included: false
---

# 57.2 Immediate responsiveness vs infrastructure safety

Immediate responsiveness and infrastructure safety pull schedule design in opposite directions. Fast retries and tight polling reduce perceived latency, but they also concentrate load at exactly the moment a dependency may already be slow, unavailable, or recovering.

This entry does not introduce a new `Schedule` primitive. It is a decision matrix for choosing between fast recurrence and safer spacing/backoff before writing code.

## Decision matrix

| Problem shape | Prefer | Schedule shape | Why |
| --- | --- | --- | --- |
| A user is actively waiting and the operation is cheap, local, or already rate-limited upstream. | Fast retries or short polling. | `Schedule.recurs` or `Schedule.take` with a very small `Schedule.spaced` delay, usually under a short `Schedule.during` budget. | The main cost is user-visible latency. A small number of quick attempts can hide brief races without turning the workflow into a long invisible wait. |
| The dependency may be overloaded, restarting, or shared by many callers. | Safer spacing or backoff. | `Schedule.exponential` with a count limit, often with `Schedule.jittered`. | Increasing delay gives the dependency recovery time. Jitter reduces synchronized retry waves across a fleet. |
| The workflow polls for readiness after creating work, such as checking whether a job or cache entry is available. | Start responsive, then slow down. | A short initial policy followed by `Schedule.exponential`, `Schedule.fibonacci`, or a larger `Schedule.spaced` cadence. | Early success is common, but persistent absence should not produce high-frequency background load. |
| The work is periodic infrastructure maintenance, heartbeats, or health checks. | Stable cadence with explicit bounds. | `Schedule.fixed` for wall-clock cadence or `Schedule.spaced` for delay after each run, usually limited in tests with `Schedule.take`. | `fixed` maintains interval boundaries and does not pile up missed runs; `spaced` waits after each completed run. Pick the operational meaning you need. |
| The operation has side effects or can duplicate external work. | Infrastructure safety first. | Backoff plus a low `Schedule.recurs` count, and only after idempotency is established. | Fast retries can amplify duplicate writes, duplicate messages, or repeated external charges. The schedule cannot make an unsafe operation safe by itself. |
| The call path is high fan-out, batch-oriented, or run by many service instances. | Conservative spacing, jitter, and budgets. | `Schedule.exponential` or `Schedule.spaced`, bounded with `Schedule.recurs`, `Schedule.take`, or `Schedule.during`, then `Schedule.jittered` when many fibers or nodes may align. | Aggregate load matters more than a single caller's latency. A harmless-looking 100 millisecond retry can become a production incident when multiplied. |

## Selection rule

Choose fast recurrence only when all of these are true: the operation is cheap, the retry count is low, the caller is waiting, duplicate effects are acceptable or impossible, and the dependency is not already under pressure.

Choose safer spacing or backoff when any of these are true: many callers may retry together, the dependency is shared, the failure mode may be overload, the operation has meaningful side effects, or the workflow can continue asynchronously.

## Practical guidance

Treat responsiveness as a budget, not a default. A fast retry policy should normally have both a small recurrence limit and a short elapsed-time limit. After that budget is spent, fail visibly, switch to a slower polling path, or move the work to the background.

Treat infrastructure safety as the default for shared systems. Use `Schedule.exponential` when repeated failure should slow the caller down, `Schedule.spaced` when each recurrence should wait after the previous run, `Schedule.fixed` when runs should target regular interval boundaries, and `Schedule.jittered` when many schedules may start at the same time.
