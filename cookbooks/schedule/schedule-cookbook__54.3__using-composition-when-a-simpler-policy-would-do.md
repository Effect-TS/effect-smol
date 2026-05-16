---
book: Effect `Schedule` Cookbook
section_number: "54.3"
section_title: "Using composition when a simpler policy would do"
part_title: "Part XII — Anti-Patterns"
chapter_title: "54. Overcomplicating Schedule Composition"
status: "draft"
code_included: false
---

# 54.3 Using composition when a simpler policy would do

Using composition when a simpler policy would do is an anti-pattern because it makes the schedule harder to read without changing the operational requirement. If the requirement is only "wait this long between runs", "try this many more times", or "keep going during this window", a composed schedule makes readers reverse-engineer behavior that `Schedule.spaced`, `Schedule.recurs`, or `Schedule.during` can state directly.

## The anti-pattern

The problematic version reaches for combinators before the policy needs them. A fixed poll becomes a composition of a zero-delay schedule and a delayed schedule. A three-retry budget becomes a composed counter whose output is ignored. A time window becomes a general elapsed schedule combined with another policy only to recover the same stopping condition.

This is not just visual noise. Composition operators have specific meaning. `Schedule.both` continues while both schedules continue, uses the larger delay, and produces a tuple. `Schedule.either` continues while either schedule continues, uses the smaller delay, and also produces a tuple. Sequential composition changes phases. If the code does not need those semantics, using them makes a simple policy look like a special case.

## Why it happens

It often happens after someone learns that schedules compose well. The API is powerful enough to build policies from smaller pieces, so it is tempting to model every recurrence as a combination of delay, count, elapsed time, and output transformation. That habit can hide the fact that the source module already provides direct constructors for common policies.

`Schedule.spaced("5 seconds")` already means "recur continuously with this delay after each run." `Schedule.recurs(3)` already means "allow this many recurrence decisions before stopping." `Schedule.during("30 seconds")` already means "continue while elapsed schedule time remains inside this duration." Those names carry the policy in the call site.

## Why it is risky

The main risk is policy drift. A reviewer may see `both`, `either`, `andThen`, or output mapping and assume the schedule has a subtle reason to coordinate multiple constraints. Later changes then preserve accidental structure instead of the actual requirement.

There is also behavioral risk. A composed schedule can change delay selection, termination, or output shape in ways that are easy to miss. For example, an unnecessary `both` makes the combined delay the maximum of its sides, while an unnecessary `either` makes it the minimum and can run until both sides are exhausted. If the intended policy was only a fixed interval, retry count, or elapsed window, those extra semantics are liabilities.

## A better approach

Start with the plain constructor that matches the sentence you would say in an incident review:

- Use `Schedule.spaced(duration)` when the requirement is a steady delay between recurrences.
- Use `Schedule.recurs(times)` when the requirement is a recurrence budget.
- Use `Schedule.during(duration)` when the requirement is an elapsed-time budget.

Compose only when there are genuinely multiple independent rules to enforce or multiple phases to express. A fixed poll with a maximum count may reasonably combine `spaced` with `recurs`. A retry policy with a backoff curve and a wall-clock budget may reasonably combine a delay shape with `during`. But the composition should be introduced because the requirement has two parts, not because composition is the default style.

## Notes and caveats

Simple does not mean under-specified. `Schedule.spaced` is unbounded unless something else limits it. `Schedule.recurs` limits how many recurrences may pass; in retry code, that means retries after the initial failed attempt. `Schedule.during` is elapsed-time based, so long-running work inside each recurrence still consumes the window.

When a simple constructor captures the policy, prefer it even if a composed version would be equivalent today. Save composition for the point where the policy really needs composition semantics.
