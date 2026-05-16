---
book: Effect `Schedule` Cookbook
section_number: "61.2"
section_title: "Repeat"
part_title: "Part XIV — Reference Appendices"
chapter_title: "61. Glossary"
status: "draft"
code_included: false
---

# 61.2 Repeat

Repeat is the operation of running an effect again after it succeeds, according
to a `Schedule`.

In Effect terms, the successful value produced by the effect becomes the input
to the schedule. The schedule then decides whether another execution should
happen, what delay should be used before that execution, and what schedule output
should be returned when repetition stops. This is why repeat policies can inspect
successful results with input-aware schedule combinators and can preserve the
latest successful value with `Schedule.passthrough`.

Repeat is different from retry. With retry, failures feed the schedule, and a
success ends the retry loop. With repeat, successes feed the schedule, and a
failure ends the repeat immediately unless the repeated effect handles or retries
that failure itself.

The first execution is not scheduled by the repeat policy. The effect runs once
immediately, and only then does the schedule control additional successful
recurrences. Count-limiting schedules therefore describe repetitions after the
initial run, not a delay before the first run.

Use repeat for polling, heartbeats, refresh loops, sampling, and other workflows
where the next run depends on the previous successful observation. Use retry when
the next run is a response to a typed failure.

Common repeat schedules include `Schedule.spaced` for a delay after each
successful run, `Schedule.fixed` for a fixed cadence, `Schedule.recurs` or
`Schedule.take` for a recurrence budget, `Schedule.during` for an elapsed-time
budget, and `Schedule.while` for stopping based on the successful value supplied
to the schedule.

Operationally, a repeat policy should make its stopping condition explicit. An
unbounded repeat such as a heartbeat may be intentional, but polling and refresh
loops usually need a count limit, elapsed-time budget, domain predicate, or
surrounding cancellation boundary.
