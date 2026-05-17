---
book: "Effect `Schedule` Cookbook"
section_number: "38.3"
section_title: "Polling"
part_title: "Part X — Choosing the Right Recipe"
chapter_title: "38. Glossary"
status: "draft"
code_included: false
---

# 38.3 Polling

Polling repeats a successful observation until a domain condition is met or a
recurrence budget expires. The observation is the successful value produced by
the effect being repeated. The `Schedule` decides whether to observe again, how
long to wait, and when the loop has run long enough.

Keep domain status separate from operational failure. A response such as
`"pending"`, `"running"`, or `"not ready"` is usually a successful value that
may justify another poll. A timeout, malformed response, authorization failure,
or unavailable endpoint is an effect failure unless the program handles or
retries it separately.

A typical polling policy uses `Schedule.spaced` for a gap after each completed
check, or `Schedule.fixed` when a wall-clock cadence matters. Add
`Schedule.passthrough` when the final result should be the latest observed
status. Add `Schedule.while` to continue only while the observed status is
non-terminal. Add `Schedule.during`, `Schedule.recurs`, or `Schedule.take` for
elapsed-time or count budgets, and `Schedule.jittered` when many clients might
otherwise poll together.

The stop condition and budget are checked at schedule decision points after
successful observations. They do not turn a failing request into a successful
poll result, and they do not interrupt a request already in flight. Use a
per-request timeout when each individual observation needs a hard deadline.

For user-facing polling, prefer short budgets and explicit outcomes over long
invisible waiting. For background reconciliation, keep the cadence modest and
measure aggregate load across all workers, not just one loop.
