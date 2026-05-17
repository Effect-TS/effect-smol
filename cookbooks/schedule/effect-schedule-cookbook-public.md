# Effect `Schedule` Cookbook

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

# Part II — Retry Recipes

## 4. Retry Limits and Simple Delays

### 4.1 Retry up to 3 times
### 4.2 Retry with a small constant delay
### 4.3 Retry immediately, but only briefly
### 4.4 Retry until the first success
### 4.5 Retry with a delay suitable for external APIs
### 4.6 Retry with different fixed delays for different environments

## 5. Exponential and Capped Backoff

### 5.1 Basic exponential backoff
### 5.2 Backoff for transient network failures
### 5.3 Backoff for overloaded downstream services
### 5.4 Backoff for startup dependency readiness
### 5.5 Backoff with a practical base interval
### 5.6 Exponential backoff with a maximum delay
### 5.7 Preventing excessively long waits
### 5.8 Backoff with both cap and retry limit

## 6. Retry Budgets and Deadlines

### 6.1 Retry for at most 10 seconds
### 6.2 Retry for at most 1 minute
### 6.3 Retry until a startup deadline
### 6.4 Retry within a fixed operational budget
### 6.5 Prefer time-budget limits over attempt counts

## 7. Error-Aware Retries

### 7.1 Retry only transient failures
### 7.2 Do not retry validation errors
### 7.3 Retry only on timeouts
### 7.4 Retry only on 5xx responses
### 7.5 Treat rate limits differently from server errors

## 8. Idempotency and Retry Safety

### 8.1 Safe retries for GET requests
### 8.2 Retrying idempotent writes
### 8.3 Why non-idempotent retries are dangerous
### 8.4 Retrying with idempotency keys
### 8.5 When not to retry at all

# Part III — Repeat Recipes

## 9. Repeat Successful Work

### 9.1 Repeat 5 times
### 9.2 Repeat forever with care
### 9.3 Repeat with a pause
### 9.4 Repeat until a condition becomes true
### 9.5 Repeat while work remains to be done

## 10. Periodic and Spaced Repeat

### 10.1 Run every minute
### 10.2 Run every hour
### 10.3 Enforce a pause between iterations
### 10.4 Slow down a tight worker loop
### 10.5 Use spacing to smooth resource usage

## 11. Repeat with Limits

### 11.1 Repeat at most N times
### 11.2 Repeat only within a time budget
### 11.3 Repeat until a threshold is reached
### 11.4 Repeat until output becomes stable
### 11.5 Repeat until a terminal state is observed

# Part IV — Polling Recipes

## 12. Poll Until Completion

### 12.1 Poll a background job until done
### 12.2 Poll payment status until settled
### 12.3 Poll an export job until ready
### 12.4 Poll cloud provisioning until ready
### 12.5 Poll until status becomes `Completed`

## 13. Poll for Resource State

### 13.1 Poll until a resource exists
### 13.2 Poll until a cache entry appears
### 13.3 Poll until replication catches up
### 13.4 Poll until eventual consistency settles

## 14. Poll with Timeouts

### 14.1 Poll every second for up to 30 seconds
### 14.2 Give up when the operation is clearly too slow
### 14.3 Distinguish “still running” from “failed permanently”
### 14.4 Return a timeout error gracefully

## 15. Adaptive and Fleet-Safe Polling

### 15.1 Fast polling during the first few seconds
### 15.2 Slow polling after initial responsiveness matters less
### 15.3 Polling strategy for user-triggered workflows
### 15.4 Polling strategy for long-running back-office jobs
### 15.5 Polling from many clients without synchronization
### 15.6 Jittered status checks in distributed systems
### 15.7 Reduce herd effects in control planes

# Part V — Delay, Backoff, and Load Control

## 16. Choose a Delay Strategy

### 16.1 Constant delays
### 16.2 Linear backoff
### 16.3 Exponential backoff
### 16.4 Capped exponential backoff

## 17. Operational Backoff Recipes

### 17.1 Backoff for unstable remote APIs
### 17.2 Backoff for queue reconnection
### 17.3 Backoff for cold-start dependencies
### 17.4 Cap long tails in retry behavior
### 17.5 Cap delays without losing backoff benefits

## 18. Spacing and Throttling

### 18.1 At least one request per second
### 18.2 Process a batch with gaps between items
### 18.3 Avoid hammering an external API
### 18.4 Smooth demand over time
### 18.5 Drain a queue slowly

## 19. Rate Limits and User-Facing Effects

### 19.1 Send emails with controlled spacing
### 19.2 Respect provider quotas
### 19.3 Space calls to a third-party API
### 19.4 Slow down after a 429 response
### 19.5 Coordinate retry and rate-limit handling

## 20. Jitter Concepts and Tradeoffs

### 20.1 Thundering herds
### 20.2 Coordinated clients
### 20.3 Recovery spikes
### 20.4 Add jitter to exponential backoff
### 20.5 Avoid synchronized retries in clustered systems
### 20.6 More stability, less predictability
### 20.7 When not to add jitter

## 21. Jitter in Real Systems

### 21.1 Jittered retries for HTTP clients
### 21.2 Jittered retries for Redis reconnects
### 21.3 Jittered retries for WebSocket reconnect
### 21.4 Jittered periodic refresh
### 21.5 Jittered cache warming

# Part VI — Composition and Termination

## 22. Stop Conditions

### 22.1 Stop when status becomes terminal
### 22.2 Stop when no more work remains
### 22.3 Stop when data becomes available
### 22.4 Stop when a value stabilizes
### 22.5 Stop on fatal errors
### 22.6 Classify errors before retrying

## 23. Combine Limits and Delays

### 23.1 Retry 5 times with fixed spacing
### 23.2 Retry 5 times with exponential backoff
### 23.3 Retry 10 times with jittered backoff
### 23.4 Poll with both interval and deadline
### 23.5 Exponential backoff plus time budget
### 23.6 Retry with cap plus max attempts

## 24. Multi-Phase Policies

### 24.1 Aggressive at startup, relaxed afterward
### 24.2 Fast checks during initialization
### 24.3 Slow background cadence after readiness
### 24.4 Immediate retries first, backoff later
### 24.5 Fast polling first, slower polling later
### 24.6 Phase-based control for long workflows

## 25. Express Operational Intent

### 25.1 “Try hard, but only briefly”
### 25.2 “Keep trying, but never aggressively”
### 25.3 “Be responsive first, conservative later”
### 25.4 “Avoid overload at all costs”
### 25.5 “Keep background work steady and predictable”

# Part VII — Real-World Recipes

## 26. Backend Recipes

### 26.1 Retry HTTP GET on timeout
### 26.2 Retry HTTP GET on 503
### 26.3 Retry HTTP POST with idempotency key
### 26.4 Retry rate-limited requests carefully
### 26.5 Poll a job-based HTTP API

## 27. Frontend and Client Recipes

### 27.1 Retry config fetch at startup
### 27.2 Retry profile loading on transient network failure
### 27.3 Retry token refresh briefly
### 27.4 Reconnect WebSocket with backoff
### 27.5 Reconnect WebSocket with jitter

## 28. Infrastructure and Platform Recipes

### 28.1 Retry dependency checks during startup
### 28.2 Poll until all required services are ready
### 28.3 Poll rollout status
### 28.4 Retry deployment hooks
### 28.5 Retry infrastructure API calls

## 29. Data and Batch Recipes

### 29.1 Poll ETL status until completion
### 29.2 Retry export generation
### 29.3 Retry file upload to object storage
### 29.4 Retry import processing after transient failures
### 29.5 Pace reprocessing of failed records

## 30. Product and Business Workflow Recipes

### 30.1 Poll payment settlement status
### 30.2 Retry payment-status fetches
### 30.3 Poll order fulfillment progress
### 30.4 Retry notification delivery
### 30.5 Repeat CRM sync every few minutes

# Part VIII — Observability and Testing

## 31. Observability, Logging, and Diagnostics

### 31.1 Log each retry attempt
### 31.2 Log computed delays
### 31.3 Track total retry duration
### 31.4 Surface termination reasons
### 31.5 Measure schedule effectiveness

## 32. Testing Recipes

### 32.1 Assert retry count
### 32.2 Assert delays between retries
### 32.3 Simulate transient failures
### 32.4 Verify no retry on fatal errors
### 32.5 Test capped backoff behavior

# Part IX — Anti-Patterns

## 33. Retrying Everything

### 33.1 Retry on validation errors
### 33.2 Retry on authorization failures
### 33.3 Retry on malformed requests
### 33.4 Retry non-idempotent side effects blindly
### 33.5 Retry without error classification

## 34. Retrying Forever

### 34.1 Missing retry limits
### 34.2 Missing time budgets
### 34.3 Unbounded backoff chains
### 34.4 Operationally invisible infinite retries
### 34.5 Background loops with no escape hatch

## 35. Polling and Jitter Mistakes

### 35.1 Poll every 100ms without need
### 35.2 Poll large fleets in sync
### 35.3 Poll when a push-based model would be better
### 35.4 Adding jitter where precise cadence matters
### 35.5 Using jitter to mask a deeper overload problem

# Part X — Choosing the Right Recipe

## 36. Recipe Selection Guide

### 36.1 “I need to retry a flaky call”
### 36.2 “I need to poll until something finishes”
### 36.3 “I need a periodic background loop”
### 36.4 “I need to avoid overload”
### 36.5 “I need to stop after a reasonable limit”

## 37. Decision Matrix by Problem Shape

### 37.1 Transient failure vs permanent failure
### 37.2 Immediate responsiveness vs infrastructure safety
### 37.3 Fixed cadence vs adaptive cadence
### 37.4 User-facing workflow vs background process
### 37.5 Single-instance behavior vs fleet-wide behavior

## 38. Glossary

### 38.1 Retry
### 38.2 Repeat
### 38.3 Polling
### 38.4 Backoff
### 38.5 Idempotency
