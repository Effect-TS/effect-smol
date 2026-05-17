---
book: Effect `Schedule` Cookbook
section_number: "61.3"
section_title: "Polling"
part_title: "Part XIV — Reference Appendices"
chapter_title: "61. Glossary"
status: "draft"
code_included: false
---

# 61.3 Polling

Polling is repeated successful observation until a condition is met or a
deadline stops the recurrence. In Schedule terms, the observed value is the
successful output of the effect being repeated; the schedule decides whether to
take another observation, how long to wait before it, and when the recurrence
budget has ended.

## What this section is about

This glossary entry clarifies the boundary between domain status and
operational failure in polling loops. A status such as "pending" is a
successful value that says another observation may be useful. Transport,
decoding, authorization, and other operational failures remain effect failures
unless the program explicitly retries them separately.

## Why it matters

Polling loops are often user-visible and infrastructure-sensitive. Without a
clear definition, code can mix status interpretation, request failure handling,
cadence, and time limits into one policy. Keeping polling as repeated
successful observations makes the boundary clear: domain state decides whether
the work is done, and the schedule decides whether another successful
observation should be attempted.

## Core idea

Use a cadence schedule such as `Schedule.spaced` or `Schedule.fixed`, preserve
the latest successful observation when the final value matters, and add a
predicate that continues only while the observation is non-terminal. Add
`Schedule.during`, `Schedule.recurs`, or `Schedule.take` when the loop also
needs an elapsed-time or count budget. Add `Schedule.jittered` when many
clients may otherwise poll in sync.

The condition and the deadline are recurrence decisions. They are checked after
successful observations; they do not turn a failing effect into a successful
poll result, and they do not interrupt a request already in flight.

## Practical guidance

Model terminal states as successful values and stop polling when one is
observed. Use separate retry policy around the status check when transient
request failures should be retried. Use a per-request timeout when each
observation must have a hard deadline, and use a schedule duration budget when
the repeat loop should stop offering more observations after enough elapsed
time. For user-facing workflows, prefer short budgets and explicit outcomes
over long invisible waiting.
