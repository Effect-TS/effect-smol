---
"effect": patch
---

Update `HttpClient.withRateLimiter` to extend rate-limit windows from `Retry-After` only when longer than the current window and to prefer rate-limit reset headers when present.
