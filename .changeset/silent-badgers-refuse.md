---
"effect": patch
---

Exposes a markStale() function on swr combinator that forcibly marks cached data as stale. The next mount or focus will trigger a refresh. Unlike the registry's invalidate, this doesn't refresh immediately. So some kind of lazy invalidation.
