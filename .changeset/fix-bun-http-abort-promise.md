---
"@effect/platform-bun": patch
---

Settle the response Promise on client abort in BunHttpServer.

When a client aborted an HTTP request, the abort handler interrupted the
fiber but never resolved the `Promise<Response>`, causing Bun to hold
the request context alive. Server-side scope finalizers wouldn't fire,
leaking streaming RPC fibers.
