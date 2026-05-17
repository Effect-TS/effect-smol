---
book: "Effect `Schedule` Cookbook"
section_number: "37.4"
section_title: "User-facing workflow vs background process"
part_title: "Part X — Choosing the Right Recipe"
chapter_title: "37. Decision Matrix by Problem Shape"
status: "draft"
code_included: false
---

# 37.4 User-facing workflow vs background process

Use this entry to choose retry and polling budgets for visible workflows and
unattended processes. The split is not "frontend versus backend"; it is whether
a person or request path is waiting, or whether a supervised process can keep
working after the caller has moved on.

## Decision matrix

| Decision | User-facing workflow | Background process |
| --- | --- | --- |
| Primary budget | Human or request latency. Prefer a short `Schedule.during` budget, a small `Schedule.recurs` count, or both. | Freshness, recovery, quota, or operational pressure. Use a larger elapsed budget only when delayed success is still valuable. |
| Retry aggressiveness | Start small and stop quickly. A brief `Schedule.exponential` policy can smooth transient failures, but long invisible waiting is worse than a clear failure. | Usually less aggressive per attempt. Start with a larger base delay, cap growth with `Schedule.modifyDelay` when needed, and avoid keeping failed work alive indefinitely. |
| Polling cadence | Use a responsive cadence only while the user is plausibly waiting. `Schedule.spaced` is clear when each poll should wait after the previous check completes. | Prefer steady, predictable cadence. `Schedule.spaced` means "run, then wait"; `Schedule.fixed` means "stay near this interval boundary" and may run immediately after slow work without replaying missed runs. |
| Composition style | Use `Schedule.both` for strict limits: continue only while both the cadence and the budget continue. This stops when either the count or elapsed budget is exhausted. | Use `Schedule.both` for local limits too, but review aggregate load separately. Use `Schedule.either` only when extending the policy is intentional, because it continues while either side continues and uses the smaller delay. |
| Jitter | Optional for a single visible workflow; useful when many clients can retry or poll together. Jitter may make one UI less predictable. | Usually preferred for fleets. `Schedule.jittered` spreads each delay between 80% and 120% of the incoming delay, reducing synchronized pressure. |
| Failure surface | Return the typed failure, timeout, or still-pending result promptly so the caller can choose the next product action. | Emit logs, metrics, or alerts when the process exhausts its retry budget. Supervision may restart the process, but the schedule should not hide repeated failure. |
| Idempotency requirement | High for writes and workflow steps. Retrying a broad user action can duplicate side effects if only one inner step was transient. | Still required. Background execution does not make unsafe side effects safe; it only changes how much time the system can spend recovering. |

## Selection rules

Choose the policy from the thing that is scarce.

If caller patience is scarce, use a short elapsed budget and a small retry
count. `Schedule.exponential` can start with tens or hundreds of milliseconds,
but it should usually be paired with `Schedule.recurs` or `Schedule.during`
through `Schedule.both`. The result stops as soon as either the recurrence count
or time window is spent.

If dependency capacity is scarce, reduce retry pressure. Use a slower base
delay, increasing backoff, jitter for many callers, and explicit limits. A
background worker can wait longer than a request, but it still needs a reason to
keep trying and a visible exhaustion point.

If freshness is scarce, choose cadence before retry behavior. For a status view
or progress check, poll quickly only inside a short window. For cache refresh,
reconciliation, or maintenance, prefer a clear `Schedule.spaced` cadence and
keep failure retry inside one iteration so "recover this run" and "run again
later" remain separate decisions.

If synchronization is the risk, add jitter to the recurrence delay. This matters
more for background workers, service replicas, browser clients released at the
same time, and control-plane polling than for a single local workflow.

## Reading the schedule

Review the final policy by asking three questions:

| Question | What to look for |
| --- | --- |
| How often can it create load? | `Schedule.spaced`, `Schedule.fixed`, `Schedule.exponential`, or a custom delay. |
| When does it stop? | `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or an input-aware condition. |
| Does composition tighten or extend it? | `Schedule.both` tightens by requiring both sides to continue and using the larger delay. `Schedule.either` extends by allowing either side to continue and using the smaller delay. |

For user-facing work, the answers should be small and easy to explain in product
terms. For background work, the answers should be easy to explain in operational
terms: expected load, maximum recovery window, fleet behavior, and what happens
when the budget is exhausted.
