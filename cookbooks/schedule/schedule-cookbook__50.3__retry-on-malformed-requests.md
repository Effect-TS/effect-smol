---
book: Effect `Schedule` Cookbook
section_number: "50.3"
section_title: "Retry on malformed requests"
part_title: "Part XII — Anti-Patterns"
chapter_title: "50. Retrying Everything"
status: "draft"
code_included: false
---

# 50.3 Retry on malformed requests

Retrying malformed requests is an anti-pattern because the request is already
structurally wrong. A bad JSON body, invalid content type, missing envelope,
corrupted signature base string, impossible query shape, or unparseable protocol
message will not become well formed because the caller waited.

## The anti-pattern

The problematic shape treats request parsing and transport recovery as the same
failure path. A client, worker, or gateway wraps the whole operation in a shared
retry policy, so malformed input is submitted repeatedly under the same schedule
used for dropped connections, timeouts, or temporary service unavailability.

The policy may look operationally responsible. It might use
`Schedule.exponential` for backoff, `Schedule.recurs` or `Schedule.take` for a
retry cap, `Schedule.during` for an elapsed budget, and `Schedule.jittered` to
avoid synchronized retries. Those are useful timing tools, but they do not
change the failure classification. A malformed request is still malformed on
every recurrence.

## Why it happens

It usually happens when retry is installed at a boundary that cannot distinguish
wire, protocol, and domain failures. The schedule is added around an HTTP call,
message handler, or RPC operation before the error model separates
"temporary infrastructure problem" from "the caller sent something this endpoint
cannot interpret."

Malformed requests are also easy to mislabel as transient because they may come
from integration drift. A caller may be on the wrong schema version, a producer
may serialize a field incorrectly, or a proxy may strip a required header. Those
problems are real, but the next retry of the same request carries the same
defect. The fix is to classify the failure and repair the producer, adapter, or
contract.

## Why it is risky

Retried malformed requests hide the strongest signal you have: the request shape
is invalid at the boundary. Instead of a fast, stable rejection that points to a
contract problem, the system produces delayed failures, repeated logs, inflated
error counts, and unnecessary load on parsers, gateways, queues, and downstream
services.

The retry can also make incident response worse. A burst of malformed messages
may look like a capacity or availability problem because the retry layer
multiplies the number of attempts. Backoff reduces the rate, and jitter spreads
the attempts out, but known-bad input still occupies the system.

For message-driven systems, retrying malformed payloads can poison a queue. The
same unparsable message may cycle until the retry budget is exhausted, delaying
valid work behind it. For request/response systems, retrying may delay the
client feedback that would let the caller correct its serializer, schema, or
headers.

## A better approach

Reject or divert malformed requests before retry. Treat parser failures,
unsupported content types, missing protocol envelopes, invalid wire formats, and
schema-incompatible payloads as terminal for that request. Return a clear client
error in request/response flows, or route the message to a dead-letter,
quarantine, or diagnostics path in asynchronous flows.

Only after classification should a schedule be selected. Use schedules for
failures that can change with time: a temporarily unavailable
downstream service, a dropped connection, a rate limit response that permits
later retry, or an eventually consistent read. Then bound the recurrence with
operators such as `Schedule.recurs`, `Schedule.take`, or `Schedule.during`, and
use `Schedule.jittered` when many callers might retry at once.

Keep the retry policy named after the retryable condition it serves, such as
"retry transient gateway failures" or "retry rate-limited sends briefly". Avoid
names like "retry malformed requests"; they encode the wrong operational
promise.

## Notes and caveats

There are cases where a malformed response from another service is caused by a
transient deployment or proxy problem. Classify that separately as a bad
upstream response or temporary protocol mismatch, not as a malformed request from
your caller. Give it a narrow, bounded retry policy only if another attempt might
observe a corrected upstream.

For inbound malformed requests, fail fast. A stricter boundary makes failures
more actionable: the caller sees that the request must be fixed, operators can
measure contract violations directly, and retry budgets remain available for
failures that time can actually resolve.
