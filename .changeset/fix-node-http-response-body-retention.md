---
"@effect/platform-node": patch
---

Avoid retaining large uploaded byte-array request bodies for the lifetime of Undici HTTP client responses. Successful responses preserve request metadata but expose an empty request body.
