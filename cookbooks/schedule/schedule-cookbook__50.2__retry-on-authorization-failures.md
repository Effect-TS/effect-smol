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

Retrying authorization failures is an anti-pattern because time does not usually
change whether the caller is allowed to perform the operation.

## The anti-pattern

The problematic version treats `401`, `403`, and other authorization errors as
transient transport failures. A broad retry policy is attached to an HTTP
client, repository, or service boundary, and every failure shape flows through
the same schedule.

The schedule may be bounded and well tuned, but it is attached to the wrong
condition. `Schedule` describes when recurrence may continue; it does not know
that an expired session, missing scope, revoked key, disabled account, or tenant
mismatch needs a different response from a dropped connection.

## Why it happens

It usually happens when retry is installed before the error model is classified.
Teams create one convenient "network retry" schedule and apply it around calls
that can fail for authentication, authorization, validation, rate limiting, and
infrastructure reasons. The schedule becomes a broad loop instead of a small
operational promise.

Authorization failures are tempting to retry because some are recoverable. An
access token might have expired, a token refresh call might race with another
caller, or a permission cache might be stale. Those are narrow recovery flows.
Model them as credential refresh or authorization-state reload, not as retries
of the protected operation.

## Why it is risky

Retried authorization failures create noisy security signals. They can look like
credential stuffing, abusive clients, or a broken integration repeatedly hitting
an endpoint with known-bad credentials. Backoff and jitter can reduce
synchronization, but they do not make an unauthorized request safer or more
correct.

They also delay the next useful action. A user may need to sign in again, an
operator may need to grant a scope, a service may need a rotated secret, or the
caller may need a clear forbidden result. Retrying the denied operation makes
that feedback arrive later and can bury the original authorization reason under
an exhausted retry budget.

## A better approach

Classify authorization failures before scheduling retries. Treat "not
authenticated" and "not authorized" as terminal for the protected operation.
Return or fail with the authorization error directly so the caller can redirect,
request permission, rotate credentials, or stop the workflow.

If the suspected cause is an expired credential, isolate that behavior into a
token refresh flow. The refresh call may have its own small schedule, commonly
bounded with `Schedule.recurs` or `Schedule.take`, and it should retry only
failures that are transient for the refresh endpoint. After a successful
refresh, run the original operation once with the new credentials. If it is
still unauthorized, stop.

Name the schedule after the recovery action, such as "refresh token briefly",
rather than "retry auth failures". The retry is for acquiring valid credentials,
not for repeatedly attempting a forbidden action.

## Notes and caveats

Some systems have authorization state that is eventually consistent after a
grant or policy update. Even there, avoid a blanket retry on every `401` or
`403`. Use a narrow, bounded wait around the operation that observes
propagation, and make the reason visible in logs and metrics.

Retry the thing that can become true with time. Network availability, refresh
endpoint availability, and policy propagation may qualify. A request made with
invalid, revoked, missing, or insufficient credentials does not.
