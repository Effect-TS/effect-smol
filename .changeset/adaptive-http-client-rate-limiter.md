---
"effect": patch
---

Integrate adaptive Retry-After feedback with HttpClient.withRateLimiter, while keeping explicit RateLimit reset headers authoritative when both header families are present.
