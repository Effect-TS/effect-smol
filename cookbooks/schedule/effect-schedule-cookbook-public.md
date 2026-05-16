# Effect `Schedule` Cookbook — Public TOC

## Preface

### Who this cookbook is for

### What this cookbook is not

### A quick mental model of `Schedule`

# Part I — Foundations

## 1. What a `Schedule` Really Represents

### 1.1 Recurrence policies as data

### 1.2 The input/output view of a schedule

### 1.3 Time, repetition, and decision points

### 1.4 Why `Schedule` is more than “retry with delay”

### 1.5 Composability as the core design idea

## 2. `repeat` vs `retry`

### 2.1 Repeating successful effects

### 2.2 Retrying failed effects

### 2.3 When the distinction matters

### 2.4 Common beginner mistakes

### 2.5 Choosing the right entry point

## 3. Minimal Building Blocks

### 3.1 Repeat a fixed number of times

### 3.2 Retry a fixed number of times

### 3.3 Add a delay between recurrences

### 3.4 Stop after a limit

### 3.5 Build intuition before composing policies

# Part II — Core Retry Recipes

## 4. Retry a Few Times

### 4.1 Retry up to 3 times

### 4.2 Retry up to 5 times

### 4.3 Retry with a small constant delay

### 4.4 Retry immediately, but only briefly

### 4.5 Retry until the first success

## 5. Retry with Fixed Delays

### 5.1 Retry every 100 milliseconds

### 5.2 Retry every second

### 5.3 Retry every 5 seconds

### 5.4 Retry with a delay suitable for external APIs

### 5.5 Retry with different fixed delays for different environments

## 6. Retry with Exponential Backoff

### 6.1 Basic exponential backoff

### 6.2 Backoff for transient network failures

### 6.3 Backoff for overloaded downstream services

### 6.4 Backoff for startup dependency readiness

### 6.5 Backoff with a practical base interval

## 7. Retry with Capped Backoff

### 7.1 Exponential backoff with a maximum delay

### 7.2 Preventing excessively long waits

### 7.3 Capped backoff for user-facing flows

### 7.4 Capped backoff for worker processes

### 7.5 Backoff with both cap and retry limit

## 8. Retry with Jitter

### 8.1 Why jitter matters

### 8.2 Add jitter to exponential backoff

### 8.3 Add jitter to fixed delays

### 8.4 Avoid synchronized retries in clustered systems

### 8.5 Jitter for reconnect storms

## 9. Retry with Deadlines and Budgets

### 9.1 Retry for at most 10 seconds

### 9.2 Retry for at most 1 minute

### 9.3 Retry until a startup deadline

### 9.4 Retry within a fixed operational budget

### 9.5 Prefer time-budget limits over attempt counts

## 10. Retry Only When It Makes Sense

### 10.1 Retry only transient failures

### 10.2 Do not retry validation errors

### 10.3 Retry only on timeouts

### 10.4 Retry only on 5xx responses

### 10.5 Treat rate limits differently from server errors

## 11. Idempotency and Retry Safety

### 11.1 Safe retries for GET requests

### 11.2 Retrying idempotent writes

### 11.3 Why non-idempotent retries are dangerous

### 11.4 Retrying with idempotency keys

### 11.5 When not to retry at all

# Part III — Core Repeat Recipes

## 12. Repeat a Successful Effect

### 12.1 Repeat 5 times

### 12.2 Repeat forever with care

### 12.3 Repeat with a pause

### 12.4 Repeat until a condition becomes true

### 12.5 Repeat while work remains to be done

## 13. Repeat Periodically

### 13.1 Run every second

### 13.2 Run every 10 seconds

### 13.3 Run every minute

### 13.4 Run every 5 minutes

### 13.5 Run every hour

## 14. Repeat with Limits

### 14.1 Repeat at most N times

### 14.2 Repeat only within a time budget

### 14.3 Repeat until a threshold is reached

### 14.4 Repeat until output becomes stable

### 14.5 Repeat until a terminal state is observed

## 15. Repeat with Controlled Spacing

### 15.1 Enforce a pause between iterations

### 15.2 Slow down a tight worker loop

### 15.3 Space expensive maintenance tasks

### 15.4 Avoid saturating a dependency

### 15.5 Use spacing to smooth resource usage

# Part IV — Polling Recipes

## 16. Poll Until Completion

### 16.1 Poll a background job until done

### 16.2 Poll payment status until settled

### 16.3 Poll an export job until ready

### 16.4 Poll a video transcode until complete

### 16.5 Poll cloud provisioning until ready

## 17. Poll with a Timeout

### 17.1 Poll every second for up to 30 seconds

### 17.2 Poll every 5 seconds for up to 2 minutes

### 17.3 Give up when the operation is clearly too slow

### 17.4 Distinguish “still running” from “failed permanently”

### 17.5 Return a timeout error gracefully

## 18. Poll Aggressively at First, Then Slow Down

### 18.1 Fast polling during the first few seconds

### 18.2 Slow polling after initial responsiveness matters less

### 18.3 Warm-up polling for startup tasks

### 18.4 Polling strategy for user-triggered workflows

### 18.5 Polling strategy for long-running back-office jobs

## 19. Poll with Jitter

### 19.1 Polling from many clients without synchronization

### 19.2 Jittered polling for dashboards

### 19.3 Jittered status checks in distributed systems

### 19.4 Jittered polling after deploys

### 19.5 Reduce herd effects in control planes

## 20. Poll Until a Desired Output Appears

### 20.1 Poll until status becomes `Completed`

### 20.2 Poll until a resource exists

### 20.3 Poll until a cache entry appears

### 20.4 Poll until replication catches up

### 20.5 Poll until eventual consistency settles

# Part V — Backoff and Delay Strategies

## 21. Choosing a Delay Strategy

## 22. Constant Delay Recipes

## 23. Linear Backoff Recipes

## 24. Exponential Backoff Recipes

## 25. Delay Capping Recipes

# Part VI — Jitter Recipes

## 26. Why Jitter Exists

## 27. Jitter for Retry

## 28. Jitter for Repeat and Polling

## 29. Jitter Tradeoffs

# Part VII — Spacing, Throttling, and Load Smoothing

## 30. Space Requests Intentionally

## 31. Throttle Internal Work

## 32. Space User-Facing Side Effects

## 33. Respect Rate Limits

# Part VIII — Stop Conditions and Termination Policies

## 34. Stop After N Attempts

## 35. Stop After a Time Budget

## 36. Stop on Output Conditions

## 37. Stop on Error Conditions

# Part IX — Composition Recipes

## 38. Combine Attempt Limits and Delays

## 39. Combine Delay Strategies and Stop Conditions

## 40. Warm-up and Steady-State Schedules

## 41. Build Multi-Phase Policies

## 42. Express Operational Intent Through Composition

# Part X — Real-World Recipes

## 43. Backend Recipes

## 44. Frontend and Client Recipes

## 45. Infrastructure and Platform Recipes

## 46. Data and Batch Recipes

## 47. Product and Business Workflow Recipes

# Part XI — Observability and Testing

## 48. Observability, Logging, and Diagnostics

## 49. Testing Recipes

# Part XII — Anti-Patterns

## 50. Retrying Everything

## 51. Retrying Forever

## 52. Polling Too Aggressively

## 53. Misusing Jitter

## 54. Overcomplicating Schedule Composition

## 55. Ignoring Operational Context

# Part XIII — Choosing the Right Recipe

## 56. Recipe Selection Guide

## 57. Decision Matrix by Problem Shape

# Part XIV — Reference Appendices

## 58. Index by Problem

## 59. Index by Operational Goal

## 60. Index by Pattern

## 61. Glossary

## 62. Further Reading
