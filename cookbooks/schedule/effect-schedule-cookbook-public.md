# Effect `Schedule` Cookbook

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

### 21.1 Immediate retries
### 21.2 Constant delays
### 21.3 Linear backoff
### 21.4 Exponential backoff
### 21.5 Capped exponential backoff

## 22. Constant Delay Recipes

### 22.1 Fixed delay for lightweight dependencies
### 22.2 Fixed delay for predictable polling
### 22.3 Fixed delay for low-risk retries
### 22.4 Fixed delay for local development
### 22.5 Why fixed delays can be enough

## 23. Linear Backoff Recipes

### 23.1 Increase delay gradually
### 23.2 Linear backoff for moderate contention
### 23.3 Linear backoff for user-facing retries
### 23.4 Linear backoff when exponential is too aggressive
### 23.5 Linear backoff with a max bound

## 24. Exponential Backoff Recipes

### 24.1 Backoff for unstable remote APIs
### 24.2 Backoff for queue reconnection
### 24.3 Backoff for broker recovery
### 24.4 Backoff for cold-start dependencies
### 24.5 Backoff for cloud control plane calls

## 25. Delay Capping Recipes

### 25.1 Never wait more than 5 seconds
### 25.2 Never wait more than 30 seconds
### 25.3 Cap long tails in retry behavior
### 25.4 Make schedules operationally predictable
### 25.5 Cap delays without losing backoff benefits

# Part VI — Jitter Recipes

## 26. Why Jitter Exists

### 26.1 Thundering herds
### 26.2 Coordinated clients
### 26.3 Recovery spikes
### 26.4 Clustered workers
### 26.5 Shared downstream dependencies

## 27. Jitter for Retry

### 27.1 Jittered retries for HTTP clients
### 27.2 Jittered retries for Redis reconnects
### 27.3 Jittered retries for WebSocket reconnect
### 27.4 Jittered retries for brokers and queues
### 27.5 Jittered retries after infrastructure incidents

## 28. Jitter for Repeat and Polling

### 28.1 Jittered periodic refresh
### 28.2 Jittered heartbeat emission
### 28.3 Jittered metrics flushing
### 28.4 Jittered dashboard refresh
### 28.5 Jittered cache warming

## 29. Jitter Tradeoffs

### 29.1 More stability, less predictability
### 29.2 Observability implications
### 29.3 Testing with jitter
### 29.4 Deterministic thinking vs randomized behavior
### 29.5 When not to add jitter

# Part VII — Spacing, Throttling, and Load Smoothing

## 30. Space Requests Intentionally

### 30.1 At least one request per second
### 30.2 Process a batch with gaps between items
### 30.3 Avoid hammering an external API
### 30.4 Slow down retries against a struggling service
### 30.5 Smooth demand over time

## 31. Throttle Internal Work

### 31.1 Drain a queue slowly
### 31.2 Reconcile records without overloading the database
### 31.3 Spread cleanup work over time
### 31.4 Limit maintenance loops
### 31.5 Pace reprocessing jobs

## 32. Space User-Facing Side Effects

### 32.1 Send emails with controlled spacing
### 32.2 Space notification retries
### 32.3 Avoid bursty reminder delivery
### 32.4 Respect provider quotas
### 32.5 Reduce spam-like behavior

## 33. Respect Rate Limits

### 33.1 Space calls to a third-party API
### 33.2 Slow down after a 429 response
### 33.3 Retry with longer spacing after quota signals
### 33.4 Build polite clients
### 33.5 Coordinate retry and rate-limit handling

# Part VIII — Stop Conditions and Termination Policies

## 34. Stop After N Attempts

### 34.1 Maximum retry count
### 34.2 Maximum repeat count
### 34.3 Count-based guardrails
### 34.4 Conservative defaults
### 34.5 Making retry behavior explicit

## 35. Stop After a Time Budget

### 35.1 Stop after 5 seconds
### 35.2 Stop after 30 seconds
### 35.3 Stop after 2 minutes
### 35.4 Use budget-based limits in production
### 35.5 Balance responsiveness and persistence

## 36. Stop on Output Conditions

### 36.1 Stop when status becomes terminal
### 36.2 Stop when no more work remains
### 36.3 Stop when a threshold is crossed
### 36.4 Stop when data becomes available
### 36.5 Stop when a value stabilizes

## 37. Stop on Error Conditions

### 37.1 Stop on fatal errors
### 37.2 Stop on authorization failures
### 37.3 Stop on validation problems
### 37.4 Stop on non-retryable downstream responses
### 37.5 Classify errors before retrying

# Part IX — Composition Recipes

## 38. Combine Attempt Limits and Delays

### 38.1 Retry 5 times with fixed spacing
### 38.2 Retry 5 times with exponential backoff
### 38.3 Retry 10 times with jittered backoff
### 38.4 Repeat every second, but no more than 30 times
### 38.5 Poll with both interval and deadline

## 39. Combine Delay Strategies and Stop Conditions

### 39.1 Exponential backoff plus time budget
### 39.2 Fixed spacing plus success predicate
### 39.3 Polling plus timeout plus terminal-state detection
### 39.4 Retry with cap plus max attempts
### 39.5 Repeat with spacing plus external cancellation

## 40. Warm-up and Steady-State Schedules

### 40.1 Aggressive at startup, relaxed afterward
### 40.2 Fast checks during initialization
### 40.3 Slow background cadence after readiness
### 40.4 Warm-up polling followed by regular monitoring
### 40.5 Transition from reactive to maintenance mode

## 41. Build Multi-Phase Policies

### 41.1 Immediate retries first, backoff later
### 41.2 Fast polling first, slower polling later
### 41.3 Short attempts first, long waits later
### 41.4 Boot-time schedule vs runtime schedule
### 41.5 Phase-based control for long workflows

## 42. Express Operational Intent Through Composition

### 42.1 “Try hard, but only briefly”
### 42.2 “Keep trying, but never aggressively”
### 42.3 “Be responsive first, conservative later”
### 42.4 “Avoid overload at all costs”
### 42.5 “Keep background work steady and predictable”

# Part X — Real-World Recipes

## 43. Backend Recipes

### 43.1 Retry HTTP GET on timeout
### 43.2 Retry HTTP GET on 503
### 43.3 Retry HTTP POST with idempotency key
### 43.4 Retry rate-limited requests carefully
### 43.5 Poll a job-based HTTP API

## 44. Frontend and Client Recipes

### 44.1 Retry config fetch at startup
### 44.2 Retry profile loading on transient network failure
### 44.3 Retry token refresh briefly
### 44.4 Reconnect WebSocket with backoff
### 44.5 Reconnect WebSocket with jitter

## 45. Infrastructure and Platform Recipes

### 45.1 Retry dependency checks during startup
### 45.2 Poll until all required services are ready
### 45.3 Poll rollout status
### 45.4 Retry deployment hooks
### 45.5 Retry infrastructure API calls

## 46. Data and Batch Recipes

### 46.1 Poll ETL status until completion
### 46.2 Retry export generation
### 46.3 Retry file upload to object storage
### 46.4 Retry import processing after transient failures
### 46.5 Pace reprocessing of failed records

## 47. Product and Business Workflow Recipes

### 47.1 Poll payment settlement status
### 47.2 Retry payment-status fetches
### 47.3 Poll order fulfillment progress
### 47.4 Retry notification delivery
### 47.5 Repeat CRM sync every few minutes

# Part XI — Observability and Testing

## 48. Observability, Logging, and Diagnostics

### 48.1 Log each retry attempt
### 48.2 Log computed delays
### 48.3 Track total retry duration
### 48.4 Surface termination reasons
### 48.5 Measure schedule effectiveness

## 49. Testing Recipes

### 49.1 Assert retry count
### 49.2 Assert delays between retries
### 49.3 Simulate transient failures
### 49.4 Verify no retry on fatal errors
### 49.5 Test capped backoff behavior

# Part XII — Anti-Patterns

## 50. Retrying Everything

### 50.1 Retry on validation errors
### 50.2 Retry on authorization failures
### 50.3 Retry on malformed requests
### 50.4 Retry non-idempotent side effects blindly
### 50.5 Retry without error classification

## 51. Retrying Forever

### 51.1 Missing retry limits
### 51.2 Missing time budgets
### 51.3 Unbounded backoff chains
### 51.4 Operationally invisible infinite retries
### 51.5 Background loops with no escape hatch

## 52. Polling Too Aggressively

### 52.1 Poll every 100ms without need
### 52.2 Poll large fleets in sync
### 52.3 Poll user-facing status too often
### 52.4 Poll without a timeout
### 52.5 Poll when a push-based model would be better

## 53. Misusing Jitter

### 53.1 Adding jitter where precise cadence matters
### 53.2 Assuming jitter preserves exact intervals
### 53.3 Forgetting that jitter complicates logs and metrics
### 53.4 Using jitter to mask a deeper overload problem
### 53.5 Randomizing behavior without sensible bounds

## 54. Overcomplicating Schedule Composition

### 54.1 Combining too many policies at once
### 54.2 Building schedules nobody can explain later
### 54.3 Using composition when a simpler policy would do
### 54.4 Hiding intent behind clever abstractions
### 54.5 Refactoring complex schedules into named patterns

## 55. Ignoring Operational Context

### 55.1 Choosing backoff without considering system load
### 55.2 Choosing polling cadence without considering cost
### 55.3 Ignoring rate limits and downstream quotas
### 55.4 Forgetting that many instances may run the same schedule
### 55.5 Designing schedules without production observability

# Part XIII — Choosing the Right Recipe

## 56. Recipe Selection Guide

### 56.1 “I need to retry a flaky call”
### 56.2 “I need to poll until something finishes”
### 56.3 “I need a periodic background loop”
### 56.4 “I need to avoid overload”
### 56.5 “I need to stop after a reasonable limit”

## 57. Decision Matrix by Problem Shape

### 57.1 Transient failure vs permanent failure
### 57.2 Immediate responsiveness vs infrastructure safety
### 57.3 Fixed cadence vs adaptive cadence
### 57.4 User-facing workflow vs background process
### 57.5 Single-instance behavior vs fleet-wide behavior

# Part XIV — Reference Appendices

## 58. Index by Problem

### 58.1 Flaky HTTP call
### 58.2 Temporary database unavailability
### 58.3 Redis reconnect
### 58.4 WebSocket reconnect
### 58.5 Background job polling

## 59. Index by Operational Goal

### 59.1 Minimize latency
### 59.2 Minimize load
### 59.3 Avoid synchronized retries
### 59.4 Bound total retry time
### 59.5 Protect downstream dependencies

## 60. Index by Pattern

### 60.1 Fixed retry count
### 60.2 Fixed delay
### 60.3 Exponential backoff
### 60.4 Capped backoff
### 60.5 Jitter

## 61. Glossary

### 61.1 Retry
### 61.2 Repeat
### 61.3 Polling
### 61.4 Backoff
### 61.5 Idempotency

## 62. Further Reading

### 62.1 Schedule API reference
### 62.2 Retry design in distributed systems
### 62.3 Polling vs push-based workflows
### 62.4 Idempotency and safe retries
### 62.5 Load shedding, rate limiting, and backpressure
