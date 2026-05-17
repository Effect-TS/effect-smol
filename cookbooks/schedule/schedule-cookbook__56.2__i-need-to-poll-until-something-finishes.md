---
book: Effect `Schedule` Cookbook
section_number: "56.2"
section_title: "“I need to poll until something finishes”"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "56. Recipe Selection Guide"
status: "draft"
code_included: false
---

# 56.2 “I need to poll until something finishes”

Use this recipe family when each repeat is a fresh observation of external
state, such as a job status endpoint, import pipeline, payment settlement, or
deployment rollout.

The schedule should answer three questions before code is written:

- How often may this process be observed?
- Which observed states stop polling?
- What budget prevents waiting forever?

## What this section is about

Polling is not the same as retrying a failed call. A retry schedule reacts to failures. A polling schedule usually repeats successful reads until the read result says the remote process is finished, failed, canceled, expired, or no longer worth watching.

Choose a polling recipe when the operation being repeated is a status check, not the original work request. Submit the work once. Then repeat the observation effect with a cadence and stop condition that match the downstream system.

## Why it matters

Unbounded polling creates load and hides stuck workflows. Overly aggressive polling can turn a harmless status page into a self-inflicted rate-limit problem. Overly slow polling makes users wait after the remote work has already completed.

A good polling policy is explicit about the cadence, the terminal states, and the maximum amount of time or attempts the caller is prepared to spend.

## Core idea

Start with a steady cadence unless the remote system asks for something else.

Use `Schedule.spaced(duration)` when every poll should wait for `duration` after the previous status check completes. This is usually the safest default for status endpoints because slow checks naturally reduce the polling rate.

Use `Schedule.fixed(duration)` when the observation should align to a regular interval. According to `Schedule.fixed`, if the action takes longer than the interval, the next run happens immediately, but missed runs do not pile up. That is useful for clock-like monitoring, but it can be too aggressive for ordinary job-status polling.

Use `Schedule.exponential(base)` or a custom `Schedule.unfold` plus `Schedule.addDelay` when early results are likely to be unready and later polls should back off. This fits long-running external workflows better than a fast constant loop.

Add a hard budget with `Schedule.during(duration)`, `Schedule.recurs(times)`, or `Schedule.take(n)`. Combine the cadence with the budget so polling stops when either the terminal state is seen or the budget is exhausted. `Schedule.during` is the natural choice for user-facing timeouts; `Schedule.recurs` or `Schedule.take` is useful when the downstream service documents an attempt limit.

Add `Schedule.jittered` when many fibers, processes, or hosts may start polling at the same time. In `Schedule`, jitter adjusts delays to a random value between 80% and 120% of the original delay, which helps avoid synchronized bursts.

## Practical guidance

Classify the states first. A polling loop needs at least three categories:

- Continue: states such as `queued`, `running`, `pending`, or `processing`.
- Success: states such as `completed`, `succeeded`, or `available`.
- Failure: states such as `failed`, `canceled`, `expired`, `rejected`, or `not_found` when disappearance is terminal for this workflow.

Do not let the schedule be the only stop condition. The repeated effect should interpret terminal states and stop with the appropriate success or failure. The schedule controls when another observation is allowed; the domain result controls whether another observation is meaningful.

Prefer `Schedule.spaced` for most polling. It gives the remote service breathing room because the delay starts after the status call finishes. Prefer `Schedule.fixed` only when the polling contract is truly interval-based.

Budget user-facing polling in wall-clock time, not just count. A policy such as "poll every second for up to 30 seconds" is easier to defend than "try 30 times" when each status call can have variable latency. For background workflows, combine an elapsed budget with a count limit if both service cost and total wait matter.

Escalate the cadence instead of polling forever. A common shape is quick initial polling for a short period, followed by slower polling, or a transition to a background notification path. Use `Schedule.andThen` when the policy has distinct phases.

Select a different recipe when the repeated action is not a status check:

- If the original request failed and should be attempted again, use the flaky-call retry recipe.
- If the process should run forever as service maintenance, use the periodic background loop recipe.
- If the main concern is protecting a dependency from aggregate pressure, use the overload recipe.
- If the question is only how to cap an existing schedule, use the reasonable-limit recipe.
