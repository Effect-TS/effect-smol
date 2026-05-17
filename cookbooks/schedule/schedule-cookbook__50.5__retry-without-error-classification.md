---
book: Effect `Schedule` Cookbook
section_number: "50.5"
section_title: "Retry without error classification"
part_title: "Part XII — Anti-Patterns"
chapter_title: "50. Retrying Everything"
status: "draft"
code_included: false
---

# 50.5 Retry without error classification

Retrying without error classification is an anti-pattern because it asks a
timing policy to make a domain decision.

## The anti-pattern

The problematic version starts with a shared retry policy before the error model
is understood. A client, worker, repository, or service helper wraps an
operation in a broad schedule because some failures are retryable. The same
policy then handles timeouts, rate limits, validation errors, authorization
failures, malformed requests, declined payments, duplicate-key errors, and
invariant violations.

The schedule may look responsible. It might use exponential backoff, fixed
spacing, a recurrence cap, an elapsed-time budget, and jitter. Those controls
shape retry traffic, but they do not classify the error. A bounded retry of a
permanent failure is still a delayed permanent failure.

This is easy to miss when the schedule is hidden in infrastructure code. A
helper named "retry remote calls" can retry every typed failure from a remote
call, even though only a small subset represent temporary infrastructure
conditions.

## Why it happens

It usually happens when recurrence is designed before the failure taxonomy. A
taxonomy is the small set of categories you use to decide what an error means.
`Schedule` is convenient and composable, so it is tempting to choose a reusable
policy before answering the more important question: which failures may safely
be attempted again?

It also happens when the retry boundary is too far from the code that
understands the domain. A low-level HTTP wrapper can see that the call failed,
but it may not know whether the failure means "the network dropped", "the token
is revoked", "the payload violates the schema", "the account is disabled", or
"the provider may already have committed the side effect".

Metric pressure can reinforce the mistake. Retrying can make a flaky operation
appear healthier because a later attempt succeeds. That is useful for genuine
transient failures. It is misleading when retry hides a permanent caller bug, a
configuration problem, or a fatal state transition.

## Why it is risky

Permanent failures consume retry budgets, queue capacity, connection slots,
logs, and downstream quota even though another attempt cannot make the request
valid. Backoff and jitter reduce synchronization, but they still spend capacity
on work that should have failed fast.

Feedback is delayed. A caller that sent invalid input should learn that
immediately. A service using revoked credentials should surface an authorization
failure. A deployment with missing configuration should fail in a way operators
can recognize. A retry schedule can bury those signals under an exhausted retry
budget.

Some failures occur after the request has left your process. If a payment
capture, order creation, message send, or external write times out, the remote
side may already have committed the action. Retrying without first classifying
the outcome and checking idempotency can duplicate work outside the process.
`Schedule` can delay and limit those attempts; it cannot make them replay-safe.

Fatal failures are not "permanent but harmless". They often mean the workflow
has lost an invariant, observed corrupted state, or reached an ambiguous
external state that requires reconciliation. Treating those failures like
transient unavailability can continue a workflow after it should stop.

## A better approach

Classify failures before retrying. Keep the classification close to the boundary
that understands the operation, and make the categories explicit enough to
review:

- transient: retryable because time may change the result
- permanent: not retryable for this request because the request or caller must
  change
- fatal: not retryable in this workflow because continuing may be unsafe or
  misleading

Only the transient category should reach the retry schedule. The schedule then
answers a smaller question: given that this failure is retryable, how should
recurrence proceed? Use schedule operators for timing and termination, such as
recurrence limits, elapsed budgets, backoff, spacing, and jitter. Do not use
them as a substitute for deciding whether the failure belongs in the retry path.

Return permanent failures directly. They are useful information, not retry
candidates. Route fatal or ambiguous failures to the recovery path that
preserves correctness: reconciliation, dead-letter handling, operator
intervention, idempotency lookup, status polling, or a pending state. Those paths
may use their own schedules, but only after the failure has been reclassified
into a specific recovery action.

Name the policy after the classified condition it protects, such as "retry
transient object-storage reads briefly" or "retry rate-limited status fetches
within the caller budget". Avoid names like "generic retry" or "retry all
downstream errors"; they hide the decision that matters most.

## Notes and caveats

Classification does not have to be elaborate, but it has to happen before retry.
A small predicate or tagged error model is usually enough to separate retryable
transport and availability failures from request, authorization, configuration,
business, and fatal workflow failures.

Some errors change category after context is added. A timeout on an idempotent
status read may be transient. A timeout after submitting a non-idempotent write
may be ambiguous or fatal until the system reconciles the external state. The
same low-level symptom can require different retry behavior depending on the
operation.

Use `Schedule` after the operation has proven that another attempt is meaningful
and safe. Classification decides whether retrying is allowed. The schedule
decides when retrying happens and when the retry budget is exhausted.
