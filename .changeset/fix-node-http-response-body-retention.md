---
"@effect/platform-node": minor
---

Add `NodeHttpClient.RetainResponseRequestBody`, which can be disabled to avoid retaining large uploaded byte-array bodies for the lifetime of Undici responses. The existing response API remains unchanged by default; when disabled, successful responses preserve request metadata but expose an empty request body.
