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

Repeat reruns an effect after it succeeds. In `Effect.repeat`, the first
execution runs immediately. Each successful value then becomes the input to the
`Schedule`; the schedule decides whether to run again, how long to wait before
that run, and which schedule output is returned when repetition stops.

Repeat stops on failure unless the repeated effect handles or retries that
failure itself. Retry is the opposite shape: failures feed the schedule, and a
success ends the retry loop.

Because the first execution is outside the schedule, count limits describe
additional successful recurrences. `Schedule.recurs(3)` allows three repeats
after the initial run, not three total executions.

Use repeat for polling, heartbeats, refresh loops, sampling, maintenance loops,
and other workflows where the next run depends on the previous successful
observation. Use retry when the next run is a response to a typed failure.

Common repeat policies start with `Schedule.spaced` for a delay after each
successful run or `Schedule.fixed` for wall-clock cadence. Add `Schedule.recurs`
or `Schedule.take` for a count budget, `Schedule.during` for an elapsed-time
budget, `Schedule.while` for a value-based stop condition, and
`Schedule.passthrough` when the final result should be the latest successful
value rather than the schedule's own counter or duration output.

Make the stopping condition visible. An unbounded heartbeat may be deliberate,
but polling and refresh loops usually need a count limit, time budget, domain
predicate, or surrounding cancellation boundary.
