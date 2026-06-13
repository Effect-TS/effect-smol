---
"effect": patch
---

Fix `HttpMiddleware.cors` overwriting the `Vary: Origin` header on preflight responses. When `allowedOrigins` is a predicate or has multiple entries and the preflight request includes `Access-Control-Request-Headers`, the middleware previously emitted only `Vary: Access-Control-Request-Headers`, dropping `Origin`. This could let a shared cache serve a preflight response cached for one origin to a request from a different origin. Vary entries are now merged into a single `Vary: Origin, Access-Control-Request-Headers` header.
