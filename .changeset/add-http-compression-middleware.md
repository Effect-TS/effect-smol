---
"effect": minor
---

Add `HttpMiddleware.compression` (and matching `HttpRouter.compression` layer) for gzip/deflate response compression.

The middleware uses the Web Standard `CompressionStream`, so it works in Node, Bun, Deno, and browser-style runtimes without a `node:zlib` dependency. It supports both `Uint8Array` and `Stream` response bodies, and mirrors Hono's `compress` defaults: skips `HEAD` requests, responses that already have `Content-Encoding`, `Cache-Control: no-transform`, `text/event-stream`, non-compressible content types, and bodies smaller than the configured threshold (default 1024 bytes). When compression is applied, `Vary: Accept-Encoding` is merged into any existing `Vary` header and strong `ETag`s are weakened.

Also adds `HttpServerResponse.removeHeader`, used internally to drop stale `Content-Length` after a stream body swap.
