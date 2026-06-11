---
"effect": patch
---

Fix `HttpClient.withRateLimiter` so already queued requests re-check current limiter state and respect newly observed `Retry-After` response headers. Repository-provided `RateLimiterStore` implementations now store `Retry-After` backoff so clients sharing a limiter key can observe the same server-imposed delay.
