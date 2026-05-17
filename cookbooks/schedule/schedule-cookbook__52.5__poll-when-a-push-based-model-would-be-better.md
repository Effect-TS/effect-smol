---
book: Effect `Schedule` Cookbook
section_number: "52.5"
section_title: "Poll when a push-based model would be better"
part_title: "Part XII — Anti-Patterns"
chapter_title: "52. Polling Too Aggressively"
status: "draft"
code_included: false
---

# 52.5 Poll when a push-based model would be better

## The anti-pattern

Polling is used as the default integration shape. A worker asks a remote API for
status every few seconds. A dashboard refreshes a large query on a fixed
cadence. A service repeatedly scans a table to discover new work. A fleet of
consumers checks for "anything changed?" even though the upstream system could
send a webhook, publish an event, expose a subscription, or enqueue work when
state changes.

The schedule may look careful. It might use `Schedule.spaced` for a predictable
delay, `Schedule.fixed` for a wall-clock cadence, `Schedule.jittered` to avoid
fleet synchronization, or `Schedule.take` / `Schedule.recurs` to avoid running
forever. Those are useful controls for legitimate polling. They do not change
the fact that every poll is still a speculative read. `Schedule` can make the
loop slower, bounded, jittered, or easier to review; it cannot turn repeated
guessing into an event-driven design.

## Why it happens

Polling is easy to add locally. The consumer can ship without asking the
producer for a new contract, provisioning a queue, validating webhook
signatures, or designing event delivery semantics. `Schedule` then makes the
loop look intentional because the cadence is explicit and composable.

That convenience can hide the architectural question: who has the information
first? If the producer observes the change, the producer is usually the better
place to emit the signal. The consumer's schedule is only guessing at the right
time to look.

## Why it is risky

The risk is not only extra requests. Polling creates a freshness-versus-load
tradeoff that push-based systems often avoid. A faster cadence reduces stale
reads but increases API traffic, database scans, cache churn, rate-limit
pressure, log volume, and cost. A slower cadence protects dependencies but makes
users and downstream workflows wait for changes the system already knows about.

Polling also fails poorly at scale. During deploys, outages, or incident
recovery, many consumers can resume the same polling loop at once. Jitter can
smooth that pattern, but it cannot remove the repeated work. Backoff can protect
a dependency during failure, but it also makes change detection slower. A count
or time budget can stop the loop, but it may stop before the change arrives.
These are symptoms of using a timer where a message would describe the real
business event.

## A better approach

Choose the communication model before choosing the schedule. If another system
owns the state transition, prefer a push contract: webhooks for cross-service or
third-party notifications, an event stream for durable state changes, a queue
for work that must be claimed and processed, or a subscription/channel when the
client needs live updates. Those designs move the recurrence problem out of the
consumer and into delivery, acknowledgement, replay, deduplication, and
backpressure mechanisms that are built for change notification.

Use `Schedule` when polling is genuinely the right boundary: a remote service
only exposes a status endpoint, the operation is short-lived and user-scoped, a
legacy dependency cannot emit events, or the poll is a safety net for missed
signals. In those cases, make the compromise explicit. Pick a cadence from the
freshness requirement and downstream cost, add jitter when many clients may run
the same loop, and add a visible termination condition with `Schedule.take`,
`Schedule.recurs`, or `Schedule.during` when the loop should not live forever.

When polling is only a fallback, document that in the schedule name and metrics.
The primary path should be the webhook, event, queue, or subscription; the
scheduled loop should repair gaps rather than define normal operation.

## Notes and caveats

Push-based systems are not free. Webhooks need authentication, idempotency,
retry handling, and dead-letter visibility. Event streams and queues need
retention, consumer ownership, replay strategy, and operational tooling. Those
costs are real, but they match the problem of delivering changes. A polling
schedule mostly controls how often the consumer asks a question.

Keep polling when the producer cannot push, when eventual freshness is enough,
or when periodic reconciliation is deliberately part of the reliability model.
Do not use a nicer `Schedule` to avoid fixing an integration contract that
should be event-driven.
