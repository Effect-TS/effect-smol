---
book: Effect `Schedule` Cookbook
section_number: "62.3"
section_title: "Polling vs push-based workflows"
part_title: "Part XIV — Reference Appendices"
chapter_title: "62. Further Reading"
status: "draft"
code_included: false
---

# 62.3 Polling vs push-based workflows

Polling and push-based workflows solve different coordination problems. Use
this entry to decide whether a scheduled loop is the right boundary, or whether
a webhook, event stream, queue, or subscription should drive the workflow
instead.

Start with who observes the change. Polling asks repeatedly, "has the state
changed yet?" Push-based workflows deliver a signal when the producer observes
the change: "this state changed" or "this work is ready."

Polling is often the fastest integration to ship because the consumer can call
an existing read endpoint. The operational cost appears later: every recurrence
is a speculative read, and the freshness of the workflow is purchased with load
on the dependency. A one-second poll may feel responsive for one user and become
expensive when thousands of clients or workers run it at the same time.

Push-based systems move the primary cost elsewhere. Webhooks require signature
validation, retry handling, deduplication, and observability. Event streams and
queues require retention, consumer ownership, acknowledgement, replay strategy,
and dead-letter handling. Those costs are real, but they match the problem of
delivering known changes. A schedule mostly controls how often a consumer asks
whether a known change might have happened.

`Schedule` is useful on the polling side because it makes recurrence explicit.
It can express fixed or spaced cadence, backoff, elapsed-time budgets,
recurrence limits, and jitter. It is still only a recurrence policy. Delivery,
acknowledgement, replay, ordering, idempotency, and backpressure belong to the
integration model around the schedule.

Prefer push when the producer already knows the meaningful transition and can
emit a durable or authenticated signal. Use webhooks for cross-system
notifications, events for domain state changes, queues for claimable work, and
subscriptions or channels for live client updates.

Use polling when the producer cannot push, when the read model is eventually
consistent and must be observed until it catches up, when a third-party API only
exposes a status endpoint, or when the scheduled loop is a reconciliation
fallback for missed signals. In those cases, make the compromise explicit:
choose the cadence from the freshness requirement and the cost of each read, add
termination when the wait should not be invisible forever, and add
desynchronization when many instances may run the same policy.

`Schedule.spaced` waits the configured duration between recurrences.
`Schedule.fixed` targets a fixed interval and, if the action takes longer than
the interval, runs the next recurrence immediately without piling up missed
runs. `Schedule.exponential` increases delay by a factor from a base duration.
`Schedule.recurs` and `Schedule.take` limit the number of recurrences.
`Schedule.during` bounds recurrence by elapsed duration. `Schedule.jittered`
randomly adjusts delays between 80% and 120% of the original delay, which helps
avoid synchronized polling across a fleet but does not remove the underlying
work.

Ask who knows about the change first. If the upstream service creates the event,
prefer an event, webhook, queue message, or subscription. If the consumer can
only learn by reading, a schedule is a reasonable way to make that read loop
bounded and observable.

Separate status observations from effect failures. A successful response that
says "queued", "running", "not ready", or "projection behind" is usually a
domain observation for `Effect.repeat`. A timeout, malformed response,
authorization error, or unavailable endpoint is usually a failure that may need
`Effect.retry` with its own schedule. Mixing those concerns makes polling loops
hard to reason about.

Keep scheduled polling modest. Use `Schedule.spaced` for ordinary status checks,
`Schedule.fixed` for periodic maintenance where wall-clock cadence matters,
`Schedule.exponential` when continued failure should reduce pressure, and
`Schedule.jittered` when many clients or workers may align. Combine cadence with
`Schedule.recurs`, `Schedule.take`, or `Schedule.during` when the caller needs a
clear stopping point.

Treat polling as a fallback when push is the intended design. A reconciliation
loop can repair missed webhooks, rebuild projections, or scan for stuck work,
but it should be named and measured as a safety net. The primary path should
still be the producer's signal, not repeated guessing by every consumer.
