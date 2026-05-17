---
book: Effect `Schedule` Cookbook
section_number: "60.2"
section_title: "Fixed delay"
part_title: "Part XIV — Reference Appendices"
chapter_title: "60. Index by Pattern"
status: "draft"
code_included: false
---

# 60.2 Fixed delay

Use this index for steady recurrence policies: delays that do not grow, shrink,
or adapt over time. The main choice is whether to wait after each run or target
a fixed cadence.

## API mapping

- `Schedule.spaced(duration)` recurs continuously, spacing each repetition by
  the given duration from the last run.
- `Schedule.fixed(interval)` recurs on a fixed interval and outputs the
  repetition count so far.

Both schedules are unbounded unless combined with a limit such as
`Schedule.take`, `Schedule.recurs`, `Schedule.during`, or a predicate such as
`Schedule.while`. Retry-level predicates can also be supplied with
`Effect.retry({ while })`.

## How to choose

Choose `Schedule.spaced` when the requirement is:

- retry after a constant pause
- poll only after the previous check has completed
- leave a quiet period between background jobs
- avoid a tight loop while keeping the policy simple

Choose `Schedule.fixed` when the requirement is:

- run periodic work on a regular cadence
- sample, flush, check, or refresh at an interval measured from the schedule clock
- keep the intended rate visible even when individual runs are shorter or longer

If work takes longer than a `fixed` interval, the next recurrence can happen
immediately, but missed runs do not pile up. If the requirement is simply "wait
five seconds after this finishes", use `Schedule.spaced("5 seconds")`.

## Related recipes

Use [5.2 Retry every second](schedule-cookbook__05.2__retry-every-second.md)
or [5.3 Retry every 5 seconds](schedule-cookbook__05.3__retry-every-5-seconds.md)
for simple retry spacing.

Use [13.1 Run every second](schedule-cookbook__13.1__run-every-second.md),
[13.3 Run every minute](schedule-cookbook__13.3__run-every-minute.md), or
[13.5 Run every hour](schedule-cookbook__13.5__run-every-hour.md) when cadence
is the point.

Use [22.2 Fixed delay for predictable polling](schedule-cookbook__22.2__fixed-delay-for-predictable-polling.md)
when polling should stay simple and observable.

Use [49.2 Assert delays between retries](schedule-cookbook__49.2__assert-delays-between-retries.md)
when tests need to verify steady delays.

## Caveats

If the policy is a retry policy, the first attempt is not delayed. The schedule
controls waits between retries after failures. If the policy is a repeat policy,
the first successful run happens before the schedule controls the next
recurrence.

Add a count or elapsed-time limit when the loop must stop. Add jitter when many
clients or workers could synchronize on the same delay. Prefer
`Schedule.exponential` or another increasing schedule when repeated failure
means the downstream system may be overloaded.

Do not build fixed delay indirectly when a constructor states the policy.
`Schedule.spaced("1 second")` means "wait one second after each run."
`Schedule.fixed("1 second")` means "run on a one-second cadence."
