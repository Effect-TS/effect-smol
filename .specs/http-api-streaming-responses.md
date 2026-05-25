# HttpApi Streaming Responses

## Summary

Add first-class `HttpApiEndpoint` support for success responses whose body is a stream.

Today, `HttpApi` definitions support schema-backed buffered responses and streaming multipart request payloads via `HttpApiSchema.asMultipartStream()`. Handlers can manually return `HttpServerResponse.stream(...)`, but that bypasses schema-backed success typing, generated clients, and OpenAPI response modeling. This specification adds declared streaming success responses while preserving the existing `HttpApi` architecture.

## Goals

- Allow endpoint `success` definitions to declare streaming response bodies.
- Preserve schema-driven item encoding and decoding for structured streams.
- Preserve generated `HttpApiClient` type safety.
- Preserve `responseMode` behavior for decoded, decoded-with-response, and raw response access.
- Emit useful OpenAPI metadata for streaming responses.
- Keep raw `HttpServerResponse` returns as the escape hatch for custom streaming behavior.

## Non-Goals

- Do not add new request streaming support beyond existing multipart streaming payloads.
- Do not add streaming error responses.
- Do not add bidirectional streaming.
- Do not add WebSocket support.
- Do not buffer streams to fit existing JSON response encoding.
- Do not infer streaming from `application/octet-stream` alone.

## Supported Stream Modes

The MVP should support declared streaming success responses for bytes, NDJSON, and Server-Sent Events.

| Mode | Default content type | Server handler success | Client decoded success |
| --- | --- | --- | --- |
| Byte stream | `application/octet-stream` | `Stream.Stream<Uint8Array, never>` | `Stream.Stream<Uint8Array, HttpClientError.HttpClientError>` |
| NDJSON stream | `application/x-ndjson` | `Stream.Stream<A, never>` | `Stream.Stream<A, HttpClientError.HttpClientError | Schema.SchemaError | Ndjson.NdjsonError>` |
| SSE stream | `text/event-stream` | `Stream.Stream<SseEvent<A>, never>` | `Stream.Stream<SseEvent<A>, HttpClientError.HttpClientError | Schema.SchemaError | Sse.Retry>` |

`SseEvent<A>` is the decoded application event shape:

```ts
export interface SseEvent<A> {
  readonly event: string
  readonly id: string | undefined
  readonly data: A
}
```

Text streaming can be added later as `asTextStream()`. It is useful, but not required for the MVP because byte streams, NDJSON, and SSE cover the primary protocol cases.

## Public API

Add response-stream annotations to `HttpApiSchema`.

```ts
export function asUint8ArrayStream(options?: {
  readonly contentType?: string | undefined
}): <S extends typeof Schema.Uint8Array>(self: S) => Uint8ArrayStream<S>

export function asNdjsonStream(options?: {
  readonly contentType?: string | undefined
}): <S extends Schema.Top>(self: S) => NdjsonStream<S>

export function asSseStream(options?: {
  readonly contentType?: string | undefined
}): <S extends Schema.Top>(self: S) => SseStream<S>
```

Optional follow-up API:

```ts
export function asTextStream(options?: {
  readonly contentType?: string | undefined
}): <S extends Schema.Top & { readonly Encoded: string }>(self: S) => TextStream<S>
```

The helper names mirror existing `HttpApiSchema.asUint8Array()`, `asText()`, and multipart helpers. They should be payload-invalid and response-valid, except `asUint8ArrayStream()` may also be considered for future request body stream support in a separate design.

## Encoding Metadata

Extend `HttpApiSchema.Encoding` with response stream metadata.

```ts
export type ResponseStreamEncoding =
  | {
      readonly _tag: "Uint8ArrayStream"
      readonly contentType: string
    }
  | {
      readonly _tag: "NdjsonStream"
      readonly contentType: string
    }
  | {
      readonly _tag: "SseStream"
      readonly contentType: string
    }
```

Keep payload and response encodings explicit:

```ts
export type Encoding = PayloadEncoding | ResponseEncoding | ResponseStreamEncoding
export type ResponseEncoding = BufferedResponseEncoding | ResponseStreamEncoding
```

`getResponseEncoding(ast)` should return buffered or streaming response encodings. Multipart remains payload-only and must still be rejected for responses.

## Type Semantics

Streaming response helpers still return `Schema.Top` values so they fit into the existing `success` field without adding a parallel endpoint constructor.

The endpoint success type should be transformed at the `HttpApiEndpoint.Success` level:

```ts
type SuccessType<S extends Schema.Top> =
  S extends HttpApiSchema.Uint8ArrayStream<infer _Item> ? Stream.Stream<Uint8Array, never> :
  S extends HttpApiSchema.NdjsonStream<infer Item> ? Stream.Stream<Item["Type"], never> :
  S extends HttpApiSchema.SseStream<infer Item> ? Stream.Stream<SseEvent<Item["Type"]>, never> :
  S["Type"]
```

The stream error channel for server handler success values must be `never`.

Reasoning:

- Declared endpoint errors are HTTP responses.
- Once a stream has started sending bytes, normal endpoint error encoding is no longer possible.
- Fallible server streams should encode errors into the stream protocol, recover internally, or use raw `HttpServerResponse.stream(...)`.

Client stream errors remain transport, framing, and schema errors because they occur while consuming the returned stream.

## Endpoint Declaration Rules

- Streaming response schemas are valid only in `success`.
- Streaming response schemas are invalid in `error`.
- `HEAD` endpoints cannot declare streaming success responses.
- `HttpApiSchema.NoContent` cannot be combined with a streaming success for the same status.
- An endpoint can declare at most one streaming success for a given status code.
- Buffered and streaming successes cannot share the same status code.
- Multiple streaming content types for the same status are rejected in the MVP. Content negotiation can be specified later.

Invalid endpoint definitions should fail early during endpoint construction, matching current validation for incompatible payload encodings.

## Server Runtime

`HttpApiBuilder` should detect streaming success encodings when building the success encoder.

Buffered success responses continue to use the existing path:

```ts
handler result -> Schema.encodeUnknownEffect(makeSuccessSchema(endpoint)) -> HttpServerResponse
```

Streaming success responses use a stream response encoder:

```ts
handler result -> stream item encoder -> HttpServerResponse.stream(...)
```

Mode-specific server behavior:

| Mode | Server encoding |
| --- | --- |
| Byte stream | Pass `Stream.Stream<Uint8Array, never>` to `HttpServerResponse.stream` |
| NDJSON stream | Encode each item with the declared schema, frame with `Ndjson.encodeSchema(schema)`, send bytes |
| SSE stream | Encode each event `data` with the declared schema, render via `Sse.encode`, UTF-8 encode strings |

Response metadata:

- Use the schema `httpApiStatus` annotation, defaulting to `200`.
- Use the stream content type from the annotation.
- Do not set `content-length` by default.
- Do not compute schema-level ETags for streams.
- Existing middleware and pre-response handlers still apply before the body is sent.

Stream failure behavior:

- If stream item encoding fails before bytes are pulled, the response stream fails before the adapter sends body chunks.
- If stream item encoding fails after bytes have been sent, the transport stream fails.
- These failures are not converted to declared endpoint error responses.

## Client Runtime

`HttpApiClient` should return a stream for declared streaming success responses.

For a streaming endpoint with default `responseMode`, the outer effect executes the HTTP request and validates the response status. The returned stream decodes bytes as it is consumed.

`responseMode` behavior:

| Response mode | Return value |
| --- | --- |
| `decoded-only` | `Effect.Effect<Stream.Stream<Item, StreamError>, RequestError, R>` |
| `decoded-and-response` | `Effect.Effect<[Stream.Stream<Item, StreamError>, HttpClientResponse.HttpClientResponse], RequestError, R>` |
| `response-only` | `Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError, R>` |

`RequestError` includes the current request execution errors, middleware errors, declared endpoint errors, and schema errors needed to decode non-streaming error responses.

`StreamError` by mode:

| Mode | Stream error |
| --- | --- |
| Byte stream | `HttpClientError.HttpClientError` |
| NDJSON stream | `HttpClientError.HttpClientError | Schema.SchemaError | Ndjson.NdjsonError` |
| SSE stream | `HttpClientError.HttpClientError | Schema.SchemaError | Sse.Retry` |

The client should capture decoding services while constructing the returned stream, so consuming the returned stream does not require services that were already required by the outer client call.

## OpenAPI Output

OpenAPI has no universal first-class stream item model. Emit standard media types plus an Effect-specific extension.

Byte stream response:

```json
{
  "content": {
    "application/octet-stream": {
      "schema": {
        "type": "string",
        "format": "binary"
      },
      "x-effect-stream": {
        "encoding": "uint8array"
      }
    }
  }
}
```

NDJSON stream response:

```json
{
  "content": {
    "application/x-ndjson": {
      "schema": {
        "$ref": "#/components/schemas/Event"
      },
      "x-effect-stream": {
        "encoding": "ndjson"
      }
    }
  }
}
```

SSE stream response:

```json
{
  "content": {
    "text/event-stream": {
      "schema": {
        "$ref": "#/components/schemas/EventData"
      },
      "x-effect-stream": {
        "encoding": "sse"
      }
    }
  }
}
```

The schema for SSE is the `data` payload schema, not the full wire event frame. The `x-effect-stream.encoding` value determines the stream framing.

## OpenAPI Generator Changes

Once declared streaming responses exist:

- Stop skipping successful `text/event-stream` responses for `HttpApi` generation.
- Map successful `text/event-stream` responses to `HttpApiSchema.asSseStream()`.
- Map `application/x-ndjson` responses to `HttpApiSchema.asNdjsonStream()`.
- Map explicit `x-effect-stream.encoding = "uint8array"` responses to `HttpApiSchema.asUint8ArrayStream()`.
- Preserve existing buffered `application/octet-stream` behavior as `HttpApiSchema.asUint8Array()` unless streaming is explicit.

This distinction is important because `application/octet-stream` can represent either a buffered binary response or a streaming byte response.

## Implementation Plan

1. Add stream response metadata in `HttpApiSchema.ts`.
2. Add endpoint construction validation for streaming success rules in `HttpApiEndpoint.ts`.
3. Update `HttpApiEndpoint` helper types so handler success values and client decoded success values become streams for streaming schemas.
4. Add stream response encoding in `HttpApiBuilder.ts`.
5. Add stream response decoding in `HttpApiClient.ts`.
6. Update `OpenApi.ts` to emit streaming media types and `x-effect-stream` metadata.
7. Update OpenAPI generator parsing and `HttpApiTransformer.ts` rendering for declared streaming responses.
8. Add runtime tests and typetests.

## Tests

Typetests:

- `asUint8ArrayStream()` makes a handler return `Stream.Stream<Uint8Array, never>`.
- `asNdjsonStream(Item)` makes a handler return `Stream.Stream<Item, never>`.
- `asSseStream(Item)` makes a handler return `Stream.Stream<SseEvent<Item>, never>`.
- `HttpApiClient` returns `Effect.Effect<Stream.Stream<Item, ...>, ...>` for streaming endpoints.
- `responseMode: "decoded-and-response"` returns `[stream, response]`.
- `responseMode: "response-only"` returns `HttpClientResponse`.
- Streaming success schemas are rejected in `error` definitions.

Runtime tests:

- Server streams bytes and client consumes bytes incrementally.
- Server streams NDJSON records and client decodes records incrementally.
- Server streams SSE events and client decodes events incrementally.
- Non-success responses from streaming endpoints still decode through declared error schemas.
- `responseMode: "response-only"` allows manual `response.stream` consumption.
- Stream item schema encoding failures fail the stream.

OpenAPI tests:

- Byte stream response emits `application/octet-stream`, binary schema, and `x-effect-stream.encoding = "uint8array"`.
- NDJSON stream response emits `application/x-ndjson` and `x-effect-stream.encoding = "ndjson"`.
- SSE stream response emits `text/event-stream` and `x-effect-stream.encoding = "sse"`.

Negative tests:

- `HEAD` with streaming success is rejected.
- Mixed buffered and streaming successes for the same status are rejected.
- Multiple streaming successes for the same status are rejected in the MVP.

## Recommended MVP Boundary

Implement these helpers first:

```ts
HttpApiSchema.asUint8ArrayStream()
HttpApiSchema.asNdjsonStream()
HttpApiSchema.asSseStream()
```

Defer `asTextStream()` and Accept negotiation until there is a concrete use case.
