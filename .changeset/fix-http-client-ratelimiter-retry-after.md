---
"effect": patch
---

Fix `HttpClient.withRateLimiter` so already queued requests respect newly observed `Retry-After` response headers.
