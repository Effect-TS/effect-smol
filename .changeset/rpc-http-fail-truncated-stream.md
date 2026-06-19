---
"effect": patch
---

`RpcClient` HTTP protocol now fails a request whose response stream closes before a terminal frame (`Exit` / `Defect` / `ClientProtocolError`) is received, instead of completing silently, closes #2440.

Previously, if a proxy or load balancer idle-timeout closed a streaming ndjson response mid-body (after the `200` was already committed, so no `504` could be sent), `runForEachArray` over the response body ended normally, `send` succeeded, and the per-request queue was never closed — the consumer hung forever with no error. The truncated stream is now surfaced as an `RpcClientError` defect.
