# DevTools v3 Port (unstable)

## Overview
Port the Effect v3 DevTools modules from `.repos/effect-old/packages/experimental/src/DevTools` into the v4 codebase under `packages/effect/src/unstable/devtools`. The port keeps the v3 wire protocol while updating the implementation to v4 patterns (string type IDs, `ServiceMap.Service`, v4 `Schema`/`Metric`/`Tracer` APIs). The resulting API must be importable from `effect/unstable/devtools` with an auto-generated barrel.

Reference: use the opentelemetry package in this repo as guidance for working with the new metrics snapshots.

## Scope and Naming
- Source modules: `DevTools.ts`, `DevTools/Client.ts`, `DevTools/Server.ts`, `DevTools/Domain.ts` in v3.
- Target modules (prefixed with `DevTools`):
  - `DevTools.ts` (layer helpers)
  - `DevToolsClient.ts` (client + tracer wiring)
  - `DevToolsServer.ts` (server run loop)
  - `DevToolsSchema.ts` (schemas, renamed from `Domain`)

## Requirements
### Exports and Layout
- Create `packages/effect/src/unstable/devtools/` and add the modules listed above.
- Generate `packages/effect/src/unstable/devtools/index.ts` via `pnpm codegen` (do not hand edit).
- Add `./unstable/devtools` to `packages/effect/package.json` `exports` and `publishConfig.exports`.
- Support subpath imports through the existing `./*` export pattern (e.g. `effect/unstable/devtools/DevToolsClient`).

### v4 Patterns
- Use `ServiceMap.Service` class syntax for the client service (`DevToolsClient`).
- Use string type IDs for any new tagged error or guard types (only if needed).
- Prefer `Effect.fnUntraced`, `Layer.effect`, and v4 `Schema` / `Metric` / `Tracer` APIs.
- Use `effect/unstable/encoding/Ndjson` and `effect/unstable/socket` modules (not `@effect/platform`).

### Protocol Compatibility (v3)
- Preserve the v3 NDJSON wire format for all messages.
- Keep tag names and schema shapes identical to v3 for:
  - `Ping`, `Pong`, `MetricsRequest`, `MetricsSnapshot`
  - `Span`, `ExternalSpan`, `SpanEvent`
  - Metrics (`Counter`, `Gauge`, `Histogram`, `Summary`, `Frequency`)
- Keep encoding semantics:
  - `Schema.BigInt` encoded as string
  - Histogram bucket Infinity encoded as `null` (and decoded back to `Infinity`)
- Keep the default WebSocket URL `ws://localhost:34437`.

## Module Details
### DevToolsSchema
- Port v3 `Domain.ts` to `DevToolsSchema.ts` using v4 `Schema` imports.
- Export schema values and their types (`Schema.Type` and `Schema.Encoded`) for:
  - `SpanStatusStarted`, `SpanStatusEnded`, `SpanStatus`
  - `ExternalSpan`, `Span`, `SpanEvent`, `ParentSpan`
  - `Ping`, `Pong`, `MetricsRequest`
  - `MetricLabel`, `Counter`, `Gauge`, `Histogram`, `Summary`, `Frequency`, `Metric`
  - `MetricsSnapshot`, `Request`, `Response`
- Keep `Request.WithoutPing` and `Response.WithoutPong` helper types.

### DevToolsClient
- Provide:
  - `DevToolsClientImpl` interface with `unsafeAddSpan`.
  - `DevToolsClient` service via `ServiceMap.Service`.
  - `make`, `layer`, `makeTracer`, `layerTracer`.
- `make` behavior:
  - Requires `Socket.Socket` and `Scope.Scope`.
  - Use `Ndjson.duplexSchemaString(Socket.toChannelString(socket), { inputSchema: DevToolsSchema.Request, outputSchema: DevToolsSchema.Response })`.
  - Use `Queue` to buffer outgoing requests.
  - Respond to `MetricsRequest` with `MetricsSnapshot`.
  - Send periodic `Ping` and flush a final metrics snapshot on finalization.
  - Keep the 1s connection wait behavior from v3.
- Metrics snapshot:
  - Use `Metric.snapshotUnsafe` with `Effect.services` to obtain the current service map.
  - Map snapshot state to v3 metric schema shapes.
- Tracer integration:
  - Wrap the current `Tracer` and forward span lifecycle to `DevToolsClientImpl`.
  - Convert v4 `Tracer.Span` to `DevToolsSchema.Span`:
    - Map `attributes: ReadonlyMap` to schema `ReadonlyMap`.
    - Convert `parent: AnySpan | undefined` into schema `Option<ParentSpan>`.
    - Map status to `Started` / `Ended` with `startTime` / `endTime` only (drop `exit`).
  - Emit `SpanEvent` on `span.event` calls and resend final span on `span.end`.
- Logging: use `Effect.annotateLogs` with `module: "DevTools"` and `service: "Client" | "Tracer"`.

### DevToolsServer
- Provide a `Client` interface with:
  - `queue: Queue.ReadonlyQueue<DevToolsSchema.Request.WithoutPing>`
  - `request: (_: DevToolsSchema.Response.WithoutPong) => Effect.Effect<void>`
- `run`:
  - Use `SocketServer.SocketServer.run` to accept sockets.
  - Duplex NDJSON with `DevToolsSchema` request/response schemas.
  - Reply to `Ping` with `Pong`.
  - Enqueue other requests into `queue`.
  - Ensure queues are shut down on completion.

### DevTools (helpers)
- `layerSocket`: alias to `DevToolsClient.layerTracer`.
- `layerWebSocket(url = "ws://localhost:34437")`: provide `Socket.layerWebSocket(url)`.
- `layer(url = "ws://localhost:34437")`: additionally provide `Socket.layerWebSocketConstructorGlobal`.

## Testing
- Add tests under `packages/effect/test/unstable/devtools/` using `@effect/vitest` and `it.effect`.
- Use `assert` from `@effect/vitest` (no `expect` in Effect tests).
- Coverage targets:
  - Schema encode/decode roundtrip for `Span`, `SpanEvent`, `MetricsSnapshot`.
  - `DevToolsClient.makeTracer` emits `unsafeAddSpan` on span create/event/end.
  - `DevToolsServer.run` ping/pong and request queue using an in-memory socket stub to avoid platform dependencies.

## Implementation Plan
1. Port v3 `Domain.ts` into `DevToolsSchema.ts` with v4 `Schema` imports and preserved encoding semantics.
2. Implement `DevToolsClient.ts` using v4 `ServiceMap.Service`, `Metric.snapshotUnsafe`, `Tracer`, `Queue`, and NDJSON duplex.
3. Implement `DevToolsServer.ts` with `SocketServer` and NDJSON duplex, preserving ping/pong behavior.
4. Add `DevTools.ts` helpers (`layerSocket`, `layerWebSocket`, `layer`) with the default URL.
5. Wire exports: update `packages/effect/package.json` exports + publishConfig, then run `pnpm codegen` to generate the devtools barrel.
6. Add tests under `packages/effect/test/unstable/devtools/` for schema, tracer hooks, and server ping/pong.
7. Run validations: `pnpm lint-fix`, `pnpm test packages/effect/test/unstable/devtools/<file>.test.ts`, `pnpm check` (run `pnpm clean` then `pnpm check` if needed), `pnpm build`, `pnpm docgen`.
