---
book: Effect `Schedule` Cookbook
section_number: "62.5"
section_title: "Load shedding, rate limiting, and backpressure"
part_title: "Part XIV — Reference Appendices"
chapter_title: "62. Further Reading"
status: "draft"
code_included: false
---

# 62.5 Load shedding, rate limiting, and backpressure

Load shedding, rate limiting, and backpressure are related operational
controls, but they solve different problems from a local `Schedule`.

A `Schedule` steps with an input and either continues with an output and a
delay or halts. That makes it a good fit for local retry timing, polling
cadence, recurring maintenance work, and bounded repeat loops. It answers
questions such as: how long should this fiber wait before the next attempt, how
many recurrences are allowed, should the delay grow, should multiple limits be
combined, and should a fleet avoid synchronized wakeups?

Those are timing questions, not capacity questions. If every caller retries
with `Schedule.exponential`, each caller is individually more polite, but the
service may still be overloaded if there are too many callers. If every worker
repeats with `Schedule.spaced`, each worker has a local cadence, but the
aggregate rate is multiplied by the number of workers. If a poller uses
`Schedule.fixed`, it keeps a regular interval and does not pile up missed runs
when the action is slow, but it still does not decide whether new external work
should be accepted.

Use `Schedule` to make recurrence behavior explicit. Use other Effect
primitives and system boundaries to decide admission, queueing, concurrency,
and shared quotas.

## What Schedule can express

`Schedule.spaced` waits a duration after each action completes. This is usually
the clearest choice for background polling, heartbeat loops, and repeated
maintenance where the action duration should be part of the total cycle time.

`Schedule.fixed` aims at a fixed interval. If an action runs longer than the
interval, the next recurrence can run immediately, but missed executions do not
pile up. Use it for periodic checks where wall-clock cadence matters more than
a fixed rest period after work.

`Schedule.windowed` aligns recurrence delays to window boundaries. It is useful
when work should happen near shared time windows, such as a sample, flush, or
refresh cycle.

`Schedule.exponential`, `Schedule.fibonacci`, `Schedule.unfold`,
`Schedule.addDelay`, and `Schedule.modifyDelay` express growing or custom
delays. They are appropriate for retries or probes that should become less
aggressive over time.

`Schedule.recurs`, `Schedule.take`, and `Schedule.during` bound recurrence by
count or elapsed time. These keep retry and polling policies from becoming
invisible infinite work.

`Schedule.jittered` randomly adjusts each delay between 80% and 120% of the
original delay. It is useful when many fibers or processes might otherwise wake
up together.

`Schedule.both` combines policies so recurrence continues only while both
policies continue, using the larger delay when schedules disagree.
`Schedule.either` continues while either policy continues and uses the smaller
delay while both sides are active. Use these combinators to state a specific
operational rule, not to accumulate limits until the policy becomes hard to
review.

## What belongs outside Schedule

Load shedding is an admission decision: reject, fail fast, degrade, or skip
work because the system is already too busy. A `Schedule` can delay later
retries after a rejection, but it does not decide whether the current request
should enter the system. That decision belongs near the resource boundary, with
explicit capacity checks, semaphores, queues, circuit breakers, health signals,
or service-level policy.

Rate limiting is a quota decision: allow only a certain number of operations per
time window, per key, per process, or across a fleet. `Schedule.fixed`,
`Schedule.spaced`, and `Schedule.windowed` can pace one local loop, but they do
not maintain shared counters or distributed token buckets. If the limit must be
global, per customer, or coordinated across workers, the quota state must live
outside the schedule.

Backpressure is a demand-shaping decision: slow producers when consumers cannot
keep up. A `Schedule` can decide when a producer should try again after it has
been told to wait, but backpressure itself usually lives in stream, queue,
channel, or protocol semantics where demand and capacity are visible.

## Practical guidance

Start by naming the control problem. If the question is "when should this same
fiber try again?", use `Schedule`. If the question is "should this new unit of
work be accepted?", design load shedding. If the question is "has this
principal exceeded a quota?", design rate limiting. If the question is "can the
downstream consumer absorb more work?", design backpressure.

For retries after overload, combine an increasing delay with a hard budget, then
add jitter when many callers may retry together. For periodic workers, choose
between `spaced`, `fixed`, and `windowed` based on whether the delay should be
measured after completion, against wall-clock intervals, or against aligned
windows. For user-facing work, prefer short elapsed budgets and clear failure
over long hidden waiting.

Always reason about aggregate behavior. A schedule that is gentle for one fiber
may be aggressive when multiplied across a process pool, deployment, or
customer base. When the guarantee depends on shared capacity, make that shared
state explicit instead of expecting a local recurrence policy to enforce it.
