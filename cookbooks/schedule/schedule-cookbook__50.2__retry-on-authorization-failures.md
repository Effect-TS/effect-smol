---
book: Effect `Schedule` Cookbook
section_number: "50.2"
section_title: "Retry on authorization failures"
part_title: "Part XII — Anti-Patterns"
chapter_title: "50. Retrying Everything"
status: "draft"
code_included: false
---

# 50.2 Retry on authorization failures

Retrying authorization failures is an anti-pattern because time does not usually change the answer. A `401` or `403` means the caller is not currently allowed to perform the operation. Running the same request again under `Schedule.exponential`, `Schedule.spaced`, or a shared retry policy usually just repeats the denial while adding load and hiding the real control-flow decision.

## The anti-pattern

The problematic version treats authorization errors like transient transport failures. A broad retry policy is attached to an HTTP client, repository, or service boundary, and every failure shape flows through the same schedule. The policy may be well behaved as a schedule, with bounded recurrences and increasing delay, but it is still attached to the wrong condition.

That mistake is easy to miss because the retry machinery is generic. `Schedule` describes when recurrence may continue; it does not know that an expired session, missing scope, revoked key, disabled account, or tenant mismatch needs a different response from a dropped connection.

## Why it happens

It usually happens when retry is installed before the error model is classified. Teams create one convenient "network retry" schedule and apply it around calls that can fail for authentication, authorization, validation, rate limiting, and infrastructure reasons. The schedule then becomes a broad loop instead of a small operational promise.

Authorization failures are also tempting to retry because some of them look recoverable. An access token might have expired, a token refresh call might race with another caller, or a permission cache might be stale. Those are narrow recovery flows. They should be modeled explicitly around refreshing credentials or reloading authorization state, not by retrying the protected operation as if the denial itself were transient.

## Why it is risky

Retried authorization failures create noisy security signals. They can look like credential stuffing, abusive clients, or a broken integration hammering an endpoint with known-bad credentials. Backoff and jitter can reduce synchronization, but they do not make an unauthorized request safer or more correct.

They also delay the path that should happen next. A user may need to sign in again, an operator may need to grant a scope, a service may need a rotated secret, or the caller may need to fail fast with a clear forbidden result. Retrying the denied operation makes that feedback arrive later and can bury the original authorization reason under an exhausted retry budget.

## A better approach

Classify authorization failures before scheduling retries. Treat "not authenticated" and "not authorized" as terminal for the protected operation. Return or fail with the authorization error directly so the caller can redirect, request permission, rotate credentials, or stop the workflow.

If the only suspected cause is an expired credential, isolate that behavior into a token refresh flow. The refresh call may have its own small schedule, commonly bounded with operators such as `Schedule.recurs` or `Schedule.take`, and it should retry only failures that are actually transient for the refresh endpoint. After a successful refresh, run the original operation once with the new credentials. If it is still unauthorized, stop.

Keep the retry schedule named after the recovery action, such as "refresh token briefly", rather than "retry auth failures". The name matters because it records the authorization decision: the retry is for acquiring valid credentials, not for repeatedly attempting a forbidden action.

## Notes and caveats

There are rare systems where authorization state is eventually consistent after a grant or policy update. Even there, avoid a blanket retry on every `401` or `403`. Use a narrowly scoped, bounded wait around the operation that observes propagation, and make the reason visible in logs and metrics.

The useful rule is simple: retry the thing that can become true with time. Network availability, refresh endpoint availability, and policy propagation may qualify. A request made with invalid, revoked, missing, or insufficient credentials does not.
