---
book: Effect `Schedule` Cookbook
section_number: "54.1"
section_title: "Combining too many policies at once"
part_title: "Part XII — Anti-Patterns"
chapter_title: "54. Overcomplicating Schedule Composition"
status: "draft"
code_included: false
---

# 54.1 Combining too many policies at once

`Schedule` composition is useful when each piece has a clear job. This section covers policies that combine so many decisions that the operational promise disappears.

## The anti-pattern

The problematic version builds one large retry or repeat policy by stacking timing, limits, elapsed budgets, jitter, fallback cadence, and output transformation in the same expression. The resulting schedule may be technically valid, but it no longer answers simple questions: how many times can this run, what delay should operators expect, and which condition actually stops the work?

This often appears as a single "standard retry policy" reused across unrelated operations. A remote read, an idempotent write, a startup probe, and a background poller each inherit the same combination of `Schedule.exponential`, `Schedule.spaced`, `Schedule.recurs`, `Schedule.take`, `Schedule.during`, `Schedule.both`, `Schedule.either`, and `Schedule.jittered`, even though their risks are different.

## Why it happens

It happens because each individual combinator looks reasonable in isolation. `Schedule.exponential` expresses increasing delay. `Schedule.take` or `Schedule.recurs` adds a count budget. `Schedule.during` adds an elapsed-time budget. `Schedule.jittered` reduces synchronized retries across many callers. `Schedule.both` can require two policies to continue, while `Schedule.either` can keep going while either policy still wants to continue.

The mistake is treating those useful pieces as decoration instead of decisions. Adding one more guardrail can make the policy less legible if nobody can say whether the count budget, time budget, fallback cadence, or jitter is the primary constraint.

## Why it is risky

Over-composition makes operational behavior hard to audit. With `Schedule.both`, recurrence continues only while both schedules continue, and the delay is the larger of the two delays. With `Schedule.either`, recurrence continues while either schedule continues, and the delay is the smaller one. Those are important differences. Buried inside a long pipeline, they can accidentally turn a strict retry budget into a longer-lived policy, or a conservative delay into a more aggressive one.

The risk is not just readability. A policy that nobody can explain is difficult to tune during an incident. Metrics may show retries, but the team may not know whether the remaining attempts come from the count limit, the elapsed budget, or an `either` branch that is still active. That uncertainty leads to defensive edits, copied policies, and more accidental load.

## A better approach

Name the policy after the promise it makes, then keep the implementation small enough to defend. A name such as `retryTransientReadFailures`, `pollUntilStartupReady`, or `refreshCacheWithFleetJitter` is more useful than a name that repeats the operators. The name should expose the operational intent: retrying transient failures, polling for readiness, spreading load, or bounding total time.

Split the policy when it has more than one reason to change. Put cadence in one named value, the retry budget in another, and fleet-wide desynchronization in another when those concerns are reused independently. Combine them at the call site or in a narrowly named final policy so the reader can still see why `Schedule.both`, `Schedule.either`, `Schedule.take`, `Schedule.during`, or `Schedule.jittered` is present.

Prefer the smallest schedule that protects the operation:

- Use `Schedule.spaced` or `Schedule.exponential` to describe cadence.
- Use `Schedule.take`, `Schedule.recurs`, or `Schedule.during` to make termination visible.
- Use `Schedule.jittered` when many callers may otherwise retry or repeat together.
- Use `Schedule.both` when all constraints must remain true.
- Use `Schedule.either` only when the longer-lived union of policies is intentional.

## Notes and caveats

Some composed schedules are exactly the right tool. A bounded exponential backoff with jitter is a common production policy. The anti-pattern is not composition itself; it is composition without a single, named operational intent.

When a policy becomes hard to name, split it before adding another combinator. If the pieces have clear names, reviewers can discuss behavior instead of reverse-engineering a pipeline of schedule operators.
