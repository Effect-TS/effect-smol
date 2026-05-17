---
book: "Effect `Schedule` Cookbook"
section_number: "38.4"
section_title: "Backoff"
part_title: "Part X — Choosing the Right Recipe"
chapter_title: "38. Glossary"
status: "draft"
code_included: false
---

# 38.4 Backoff

Backoff is the delay shape used when recurrence should become less aggressive,
most often after repeated transient failures. It is not a separate Effect
primitive. It is the sequence of delays a `Schedule` offers between attempts.

Backoff is only one part of a recurrence policy. The delay shape says when the
next attempt may start. Other combinators decide how many recurrences are
allowed, which inputs may continue, and when an elapsed-time budget has expired.

Common delay shapes:

- Fixed backoff uses the same delay each time. `Schedule.spaced` waits after
  each completed attempt; `Schedule.fixed` targets interval boundaries and does
  not pile up missed runs.
- Linear backoff increases by a constant amount on each recurrence. There is no
  dedicated linear-backoff constructor in `Schedule.ts`; model this with state,
  such as `Schedule.unfold`, plus `Schedule.addDelay` or
  `Schedule.modifyDelay`.
- Exponential backoff multiplies the delay each time.
  `Schedule.exponential(base, factor)` starts with the base duration and uses a
  default factor of `2`.
- Capped backoff is an increasing delay with an upper bound. The cap limits the
  delay, not the number of recurrences.

Use fixed backoff when a steady retry pace is acceptable. Use linear backoff
when pressure should increase gently. Use exponential backoff when repeated
failure may indicate overload or temporary unavailability. Add a cap when the
tail delay would otherwise exceed the workflow's latency or recovery budget.

Backoff should usually be paired with an explicit stop condition such as
`Schedule.recurs`, `Schedule.take`, or `Schedule.during`. Add
`Schedule.jittered` when many fibers, processes, or clients could otherwise
retry on the same delay boundaries. In `Schedule.ts`, jitter adjusts each delay
randomly between 80% and 120% of the original delay.
