---
book: Effect `Schedule` Cookbook
section_number: "57.5"
section_title: "Single-instance behavior vs fleet-wide behavior"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "57. Decision Matrix by Problem Shape"
status: "draft"
code_included: false
---

# 57.5 Single-instance behavior vs fleet-wide behavior

Single-instance behavior vs fleet-wide behavior is a decision-matrix entry for choosing a schedule by operational scope. A schedule describes the recurrence behavior of one running workflow. If the same workflow runs in many processes, pods, browsers, or workers, the downstream system sees the sum of all of those independent schedules.

## What this section is about

Use this entry when the local policy looks reasonable but the fleet-wide behavior may not be. `Schedule.spaced("10 seconds")` is modest for one process. Across 200 instances, it can mean up to 200 follow-up attempts every interval if the instances line up. `Schedule.exponential`, `Schedule.recurs`, `Schedule.take`, `Schedule.during`, and `Schedule.jittered` change different parts of that multiplication, so choose them for the risk they actually control.

## Why it matters

Schedules do not coordinate across instances by themselves. Each fiber or process steps its own schedule, makes its own recurrence decision, and sleeps for its own computed delay. That is the right abstraction for local retry and repeat behavior, but it means a safe-looking local cadence can become a thundering herd when many copies start together, fail together, or deploy together.

## Decision matrix

| Problem shape | Main question | Prefer | Why |
| --- | --- | --- | --- |
| One process performs a local background loop | How often should this one loop run? | `Schedule.spaced` for a gap after work, or `Schedule.fixed` for a clock-like interval | The policy is mostly about local cadence. `fixed` keeps a regular interval and does not pile up missed runs when work takes longer than the interval. `spaced` waits the configured duration after each recurrence decision. |
| One process retries a transient failure | How quickly should this caller recover, and when should it stop? | `Schedule.exponential` with `Schedule.recurs`, `Schedule.take`, or `Schedule.during` | Backoff reduces repeated pressure from the same caller. Count and elapsed-time limits keep the retry from becoming an invisible long-running workflow. |
| Many instances may retry the same dependency | What is the aggregate retry rate? | Backoff plus a retry limit, usually with `Schedule.jittered` | Instance count multiplies attempts. A policy that allows 5 retries allows up to `instances * 5` retries for a shared outage. Jitter spreads those retry decisions instead of letting them happen in lockstep. |
| Many instances poll the same control plane | What is the steady-state request rate? | Wider `Schedule.spaced` or `Schedule.fixed` intervals, often jittered | Periodic work multiplies continuously, not only during failures. A 30-second poll from 120 instances is roughly 4 requests per second before any retries are added. |
| Many instances start at the same time | What happens after deploys, restarts, or autoscaling? | Add jitter to the runtime cadence, and avoid very short initial spacing unless the dependency can absorb it | Identical schedules started together tend to stay aligned. Jitter adjusts each recurrence delay between 80% and 120% of the original delay, which breaks alignment without changing the base policy beyond recognition. |
| Downstream capacity is strict | Is local scheduling enough? | Schedule caps plus external rate limiting, leasing, partitioning, or queue backpressure | `Schedule` controls when one workflow tries again. It does not enforce a fleet-wide quota, global concurrency limit, or single active owner. Use a coordination mechanism when the invariant is global. |

## Practical guidance

Start by estimating the local policy, then multiply it by the number of instances that can run it at once. Include the first attempt outside the schedule when reasoning about retries: the schedule governs follow-up decisions, while the original operation has already happened.

Use spacing when the main problem is steady-state load. `Schedule.spaced` is easier to reason about for work that should leave a gap after completion. `Schedule.fixed` is useful when the interval should remain tied to regular time windows, with the important caveat that late work runs the next recurrence immediately but does not accumulate missed runs.

Use caps when the main problem is worst-case retry volume. `Schedule.recurs(5)` or `Schedule.take(5)` may be small locally, but the fleet-wide maximum is still multiplied by the number of active instances and by the number of failing operations per instance. Add `Schedule.during` when the elapsed budget is more important than the exact attempt count.

Use jitter when the main problem is synchronization. `Schedule.jittered` randomly modifies each delay between 80% and 120% of the computed delay. It does not reduce the total number of attempts; it spreads them over time. That makes it valuable for fleets and less appropriate when exact cadence is the feature being promised.

If the desired behavior is "only one instance should do this", do not solve that with a local schedule. Use a lease, leader election, a queue with one consumer per partition, or another coordination primitive. Then apply `Schedule` inside the elected or assigned worker to describe that worker's local retry, polling, or repeat policy.
