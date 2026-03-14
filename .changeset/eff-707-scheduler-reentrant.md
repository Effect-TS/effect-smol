---
"effect": patch
---

Fix stack overflow risk in scheduler-driven infinite streams when scheduler callbacks execute synchronously.

This makes `Scheduler.MixedScheduler` resilient to reentrant scheduling, which fixes scenarios like `Stream.fromEffectSchedule(..., Schedule.forever)` in environments with sync `setImmediate` behavior.
