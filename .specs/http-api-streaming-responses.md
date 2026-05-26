# HttpApi Streaming Responses

## Summary

Add first-class `HttpApiEndpoint` support for success responses whose body is a stream, focused on two initial use cases:

- Server-Sent Events with typed events and a reserved failure event that carries the full stream failure `Cause`.
- Binary byte streams backed by `Stream.Stream<Uint8Array, unknown>`.

Today, `HttpApi` definitions support schema-backed buffered responses and streaming multipart request payloads via `HttpApiSchema.asMultipartStream()`. Handlers can manually return `HttpServerResponse.stream(...)`, but that bypasses schema-backed success typing, generated clients, and OpenAPI response modeling. This specification adds declared streaming success responses while preserving the existing `HttpApi` architecture.

## Goals

- Allow endpoint `success` definitions to declare streaming response bodies.
- Support typed SSE streams where the server handler returns `Stream<A, E>`, a failure is sent as an encoded `Cause<E>`, and the client receives `Stream<A, E | HttpErrors>` while preserving the full failure cause.
- Support binary byte streams where the server handler returns `Stream<Uint8Array, unknown>` and the client receives `Stream<Uint8Array, HttpErrors>`.
- Preserve generated `HttpApiClient` type safety.
- Preserve `responseMode` behavior for decoded, decoded-with-response, and raw response access.
- Emit useful OpenAPI metadata for streaming responses.
- Keep raw `HttpServerResponse` returns as the escape hatch for custom streaming behavior.

## Non-Goals

- Do not add NDJSON streaming in the initial design.
- Do not add text streaming in the initial design.
- Do not add new request streaming support beyond existing multipart streaming payloads.
- Do not add streaming endpoint error HTTP responses beyond the pre-stream status phase.
- Do not add bidirectional streaming.
- Do not add WebSocket support.
- Do not buffer streams to fit existing JSON response encoding.
- Do not infer streaming from `application/octet-stream` alone.

## Public API

Add constructor-style streaming success schemas to `HttpApiSchema`.

```ts
export const StreamSse: <Events extends Schema.Top, Error extends Schema.Top>(options: {
  readonly contentType?: string | undefined
  readonly events: Events
  readonly error: Error
}) => StreamSse<Events, Error>

export const StreamUint8Array: (options?: {
  readonly contentType?: string | undefined
}) => StreamUint8Array
```

These are schema-like endpoint success declarations, not regular value schemas. They exist to participate in `HttpApiEndpoint` type derivation, server response encoding, client response decoding, and OpenAPI generation. For SSE, `error` is the typed stream failure schema used inside `Schema.Cause(error, Schema.Defect)` when encoding the reserved failure event.

Example SSE declaration:

```ts
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiSchema } from "effect/unstable/httpapi"

const Events = Schema.Union([
  Schema.Struct({
    event: Schema.Literal("user.created"),
    data: Schema.Struct({ id: Schema.String })
  }),
  Schema.Struct({
    event: Schema.Literal("user.deleted"),
    data: Schema.Struct({ id: Schema.String })
  })
])

const StreamError = Schema.Struct({
  reason: Schema.String
})

HttpApiEndpoint.get("events", "/events", {
  success: HttpApiSchema.StreamSse({
    events: Events,
    error: StreamError
  }),
  error: []
})
```

Example binary stream declaration:

```ts
HttpApiEndpoint.get("download", "/download", {
  success: HttpApiSchema.StreamUint8Array({
    contentType: "application/octet-stream"
  }),
  error: []
})
```

## Supported Stream Modes

| Mode | Default content type | Server handler success | Client decoded success |
| --- | --- | --- | --- |
| SSE stream | `text/event-stream` | `Stream.Stream<Events["Type"], Error["Type"]>` | `Stream.Stream<Events["Type"], Error["Type"] | HttpClientError.HttpClientError | Schema.SchemaError | Sse.Retry>` |
| Byte stream | `application/octet-stream` | `Stream.Stream<Uint8Array, unknown>` | `Stream.Stream<Uint8Array, HttpClientError.HttpClientError>` |

The endpoint constructor continues to support buffered success schemas. Streaming declarations are additional success declaration variants.

## SSE Event Model

`StreamSse` is event-oriented. The `events` schema describes the decoded application events emitted by the server stream and consumed by the client stream.

Each event value must encode to this wire event shape:

```ts
export interface StreamSseEventEncoded {
  readonly event: string
  readonly id?: string | undefined
  readonly data: string
}
```

The recommended application pattern is to define event variants whose encoded side includes an `event` discriminator and JSON-string data. The implementation may provide convenience schemas later, but the initial contract should only require that `events` encodes to the SSE event shape.

Example event schema shape:

```ts
const UserCreated = Schema.Struct({
  event: Schema.Literal("user.created"),
  id: Schema.optional(Schema.String),
  data: Schema.Struct({
    id: Schema.String,
    name: Schema.String
  }).pipe(Schema.encodeJsonString)
})
```

If the existing schema toolkit does not expose a direct `encodeJsonString` helper, implementation should use the repository's established schema transformation pattern for JSON string encoding.

## SSE Failure Sentinel

SSE is the only initial streaming mode with a typed stream error protocol. The protocol uses a reserved sentinel event to communicate that the server stream failed after the HTTP response had already started.

`StreamSse({ events, error })` means:

- Server handlers return `Stream.Stream<events.Type, error.Type>`.
- Stream failures are encoded into the SSE stream as a reserved failure event containing the full `Cause<error.Type>`.
- Clients decode that reserved failure event and fail the returned stream with the decoded cause.

Reserved failure event:

```ts
const failureEvent = {
  event: "effect/httpapi/stream/failure",
  data: "encoded cause"
}
```

The `data` field is the encoded full `Cause` of the server stream failure, not only the typed error value. The cause schema is derived as:

```ts
const FailureCause = Schema.Cause(error, Schema.Defect)
```

The encoded cause should be serialized into the SSE `data` field as JSON. This preserves typed failures, defects, interrupts, parallel/sequential cause structure, and any cause metadata supported by `Schema.Cause`.

Rules:

- `effect/httpapi/stream/failure` is reserved by `HttpApiSchema.StreamSse`.
- User event schemas must not emit `event: "effect/httpapi/stream/failure"`.
- If `events` can encode `effect/httpapi/stream/failure`, endpoint construction should reject it when statically detectable. Runtime encoding should still guard and fail the stream if a user event emits the reserved event name.
- A server stream failure should write one `effect/httpapi/stream/failure` event and then complete the transport stream.
- Client decoding of `effect/httpapi/stream/failure` should decode `data` with `Schema.Cause(error, Schema.Defect)` and fail the returned stream with that cause.
- Client decoding failures for malformed failure events should fail with `Schema.SchemaError`.

This gives the intended API shape:

```ts
// server
Stream.Stream<A, E>

// client
Stream.Stream<A, E | HttpErrors>
```

The client type remains `E | HttpErrors` because Effect stream error channels are typed by failure values. The implementation should use cause-level failure, not value-level failure, when the sentinel is received so the decoded full cause is preserved.

## Binary Stream Errors

`StreamUint8Array` does not define a typed stream error protocol.

Server handlers return:

```ts
Stream.Stream<Uint8Array, unknown>
```

Client methods return:

```ts
Stream.Stream<Uint8Array, HttpClientError.HttpClientError>
```

Server-side stream failures are transport failures. They are not encoded into declared endpoint errors because byte streams have no framing contract for typed failures.

## Type Semantics

Add a success type mapping for streaming declarations.

```ts
type SuccessType<S> =
  S extends HttpApiSchema.StreamSse<infer Events, infer Error>
    ? Stream.Stream<Events["Type"], Error["Type"]>
    : S extends HttpApiSchema.StreamUint8Array
      ? Stream.Stream<Uint8Array, unknown>
      : S extends Schema.Top
        ? S["Type"]
        : never
```

Add a client success type mapping.

```ts
type ClientSuccessType<S> =
  S extends HttpApiSchema.StreamSse<infer Events, infer Error>
    ? Stream.Stream<
        Events["Type"],
        Error["Type"] | HttpClientError.HttpClientError | Schema.SchemaError | Sse.Retry
      >
    : S extends HttpApiSchema.StreamUint8Array
      ? Stream.Stream<Uint8Array, HttpClientError.HttpClientError>
      : S extends Schema.Top
        ? S["Type"]
        : never
```

These mappings should be used by handler return types, client return types, and endpoint helper types. The existing stored endpoint shape can still keep the `success` set internally, but it needs to distinguish buffered schemas from streaming response declarations.

## Endpoint Declaration Rules

- Streaming declarations are valid only in `success`.
- Streaming declarations are invalid in `error`.
- `HEAD` endpoints cannot declare streaming success responses.
- `HttpApiSchema.NoContent` cannot be combined with a streaming success for the same status.
- An endpoint can declare at most one streaming success for a given status code.
- Buffered and streaming successes cannot share the same status code.
- Multiple streaming content types for the same status are rejected in the initial design. Content negotiation can be specified later.
- `StreamSse` event schemas must not use the reserved `effect/httpapi/stream/failure` event name.

Invalid endpoint definitions should fail early during endpoint construction when possible, matching current validation for incompatible payload encodings.

## Server Runtime

`HttpApiBuilder` should detect streaming success declarations when building the success encoder.

Buffered success responses continue to use the existing path:

```ts
handler result -> Schema.encodeUnknownEffect(makeSuccessSchema(endpoint)) -> HttpServerResponse
```

Streaming success responses use a stream response encoder:

```ts
handler result -> stream encoder -> HttpServerResponse.stream(...)
```

Mode-specific server behavior:

| Mode | Server encoding |
| --- | --- |
| SSE stream | Encode `events.Type` values to SSE events, encode stream failure causes as reserved `effect/httpapi/stream/failure` events, UTF-8 encode rendered SSE text |
| Byte stream | Pass `Stream.Stream<Uint8Array, unknown>` to `HttpServerResponse.stream` |

Response metadata:

- Use the declaration `httpApiStatus` annotation, defaulting to `200`.
- Use the stream content type from the declaration.
- Do not set `content-length` by default.
- Do not compute schema-level ETags for streams.
- Existing middleware and pre-response handlers still apply before the body is sent.

SSE failure encoding:

1. Encode each successful stream item with `events`.
2. Reject any successful event whose encoded event name is `effect/httpapi/stream/failure`.
3. On stream failure, capture the full `Cause<error.Type>`.
4. Encode the cause with `Schema.Cause(error, Schema.Defect)`.
5. JSON-serialize the encoded cause into the SSE `data` field.
6. Render a single SSE event with `event: "effect/httpapi/stream/failure"` and the encoded cause in `data`.
7. End the stream after the failure event.

Binary stream failure behavior:

- If the stream fails before bytes are pulled, the response stream fails before the adapter sends body chunks.
- If the stream fails after bytes have been sent, the transport stream fails.
- These failures are not converted to declared endpoint error responses.

## Client Runtime

`HttpApiClient` should return a stream for declared streaming success responses.

For a streaming endpoint with default `responseMode`, the outer effect executes the HTTP request and validates the response status. The returned stream decodes bytes as it is consumed.

`responseMode` behavior:

| Response mode | Return value |
| --- | --- |
| `decoded-only` | `Effect.Effect<ClientStream, RequestError, R>` |
| `decoded-and-response` | `Effect.Effect<[ClientStream, HttpClientResponse.HttpClientResponse], RequestError, R>` |
| `response-only` | `Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError, R>` |

`RequestError` includes request execution errors, middleware errors, declared endpoint errors, and schema errors needed to decode non-streaming error responses.

`ClientStream` by mode:

| Mode | Client stream |
| --- | --- |
| SSE stream | `Stream.Stream<Events["Type"], Error["Type"] | HttpClientError.HttpClientError | Schema.SchemaError | Sse.Retry>` |
| Byte stream | `Stream.Stream<Uint8Array, HttpClientError.HttpClientError>` |

The client should capture decoding services while constructing the returned stream, so consuming the returned stream does not require services that were already required by the outer client call. When the client receives the reserved `effect/httpapi/stream/failure` event, it must decode the JSON `data` field with `Schema.Cause(error, Schema.Defect)` and fail the stream with the decoded cause.

## OpenAPI Output

OpenAPI has no universal first-class stream item model. Emit standard media types plus an Effect-specific extension.

SSE stream response:

```json
{
  "content": {
    "text/event-stream": {
      "schema": {
        "$ref": "#/components/schemas/Event"
      },
      "x-effect-stream": {
        "encoding": "sse",
        "causeSchema": {
          "$ref": "#/components/schemas/StreamError"
        },
        "failureEvent": "effect/httpapi/stream/failure"
      }
    }
  }
}
```

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

For SSE, the OpenAPI schema describes successful application events. The `x-effect-stream.causeSchema` extension describes the typed stream failure cause. It may point at the typed `error` schema with the understanding that Effect tooling wraps it in `Schema.Cause(error, Schema.Defect)`, or it may point at the generated encoded cause schema if the OpenAPI generator can materialize it directly.

## OpenAPI Generator Changes

Once declared streaming responses exist:

- Stop skipping successful `text/event-stream` responses for `HttpApi` generation when the response has enough metadata to generate `StreamSse`.
- Map `x-effect-stream.encoding = "sse"` responses to `HttpApiSchema.StreamSse({ events, error })`.
- Map `x-effect-stream.encoding = "uint8array"` responses to `HttpApiSchema.StreamUint8Array()`.
- Preserve existing buffered `application/octet-stream` behavior as `HttpApiSchema.asUint8Array()` unless streaming is explicit.
- Continue warning or skipping unannotated `text/event-stream` responses if the cause/error schema cannot be recovered.

This distinction is important because `application/octet-stream` can represent either a buffered binary response or a streaming byte response.

## Implementation Plan

- [x] Add `StreamSse` and `StreamUint8Array` declarations in `HttpApiSchema.ts`.
- [x] Add response declaration metadata and predicates for streaming responses.
- [x] Add endpoint construction validation for streaming success rules in `HttpApiEndpoint.ts`.
- [x] Update `HttpApiEndpoint` helper types so handler success values and client decoded success values become streams for streaming declarations.
- [x] Add SSE and binary stream response encoding in `HttpApiBuilder.ts`.
- [x] Add SSE and binary stream response decoding in `HttpApiClient.ts`.
- [x] Update `OpenApi.ts` to emit streaming media types and `x-effect-stream` metadata.
- [ ] Update OpenAPI generator parsing and `HttpApiTransformer.ts` rendering for declared streaming responses.
- [x] Add focused constructor runtime tests and typetests.

Current implementation note: the first step introduced `HttpApiSchema.StreamSse` and `HttpApiSchema.StreamUint8Array` as schema-like streaming success declarations with their own metadata and predicates. They are intentionally not represented with the existing buffered response encoding annotation, so later endpoint/server/client/OpenAPI work must branch on the streaming declaration predicates before using ordinary schema response encoders.

Current endpoint note: `HttpApiEndpoint` now accepts streaming declarations in `success`, stores them without JSON/string-tree codec conversion, rejects them in `error`, and validates the initial streaming success constraints during construction. Streaming declarations currently have no status annotation API, so endpoint validation treats them as success status `200`; same-status conflict checks are therefore based on that default until a future status customization design exists. Server/client runtime streaming support and OpenAPI output remain intentionally deferred.

Current type helper note: `HttpApiEndpoint` handler helpers now map `StreamSse({ events, error })` to `Stream.Stream<events.Type, error.Type>` and `StreamUint8Array()` to `Stream.Stream<Uint8Array, unknown>`. Generated client method helpers now map decoded streaming successes to stream values while preserving `decoded-and-response` and `response-only` response modes. Streaming SSE success service helpers include both event and stream-error schema services; byte streams do not add success schema services.

Current server runtime note: `HttpApiBuilder` now preserves raw `HttpServerResponse` returns, detects declared streaming success responses before buffered success encoding, streams `Uint8Array` chunks with the declaration content type, and renders SSE success events as UTF-8 encoded event-stream chunks. SSE user events are encoded with the declaration `events` schema and guarded against the reserved `effect/httpapi/stream/failure` event name. SSE stream failures are recovered into exactly one reserved failure event and then complete the transport stream. The failure cause is encoded through `Schema.toCodecJson(Schema.Cause(error, Schema.Defect))` before JSON serialization so the `data` field contains a JSON-safe full-cause representation; client decoding should mirror that JSON codec. The implementation also normalizes a missing encoded `id` to `undefined` before validating the SSE wire shape because the current `Sse.EventEncoded` schema accepts `undefined` but still expects the key to be present.

Current server runtime test note: focused `HttpApiBuilder` tests now cover byte-stream content type and chunks, incremental SSE success rendering, SSE failure sentinel rendering with a decodable full cause, and runtime rejection of a successful user event with the reserved failure name. End-to-end client streaming coverage remains deferred until `HttpApiClient` stream decoding is implemented.

Current client runtime note: `HttpApiClient` now detects declared streaming success responses at status `200` before buffered success decoding. `StreamUint8Array` successes return the raw response byte stream after status/error-schema handling. `StreamSse` successes decode UTF-8 response bytes through the SSE parser, decode ordinary events with the declaration `events` schema, and treat `effect/httpapi/stream/failure` as a reserved failure event whose `data` is decoded with `Schema.fromJsonString(Schema.toCodecJson(Schema.Cause(error, Schema.Defect)))` before failing the returned stream with the decoded full cause. The returned stream is provided with the call-time context so schema decoding services are captured by the outer client call; `response-only` still bypasses stream decoding and returns the raw response.

Current client runtime test note: focused `HttpApiClient` tests now cover incremental SSE event consumption, reserved SSE failure event cause preservation, incremental byte stream consumption, declared endpoint error decoding before stream return for non-success statuses, and manual raw response stream consumption with `responseMode: "response-only"`.

Current OpenAPI note: `OpenApi.fromApi` now emits declared streaming success responses at status `200`, matching the current endpoint/runtime limitation that streaming declarations have no status annotation API. SSE declarations use the declared/default `text/event-stream` content type, describe successful events with the `events` schema, and attach `x-effect-stream` metadata with `encoding: "sse"`, the reserved failure event name, and a `causeSchema` generated from `Schema.toCodecJson(Schema.Cause(error, Schema.Defect))` to mirror the server/client failure sentinel codec. Byte stream declarations use the declared/default `application/octet-stream` content type, the same binary string schema shape as buffered `asUint8Array`, and `x-effect-stream: { encoding: "uint8array" }`.

## Tests

Typetests:

- `StreamSse({ events, error })` makes a handler return `Stream.Stream<events.Type, error.Type>`.
- `StreamSse({ events, error })` makes a client return `Effect.Effect<Stream.Stream<events.Type, error.Type | HttpErrors>, ...>`.
- `StreamUint8Array()` makes a handler return `Stream.Stream<Uint8Array, unknown>`.
- `StreamUint8Array()` makes a client return `Effect.Effect<Stream.Stream<Uint8Array, HttpClientError.HttpClientError>, ...>`.
- `responseMode: "decoded-and-response"` returns `[stream, response]`.
- `responseMode: "response-only"` returns `HttpClientResponse`.
- Streaming declarations are rejected in `error` definitions.

Runtime tests:

- Server streams SSE events and client decodes events incrementally.
- Server SSE stream fails and emits a reserved `effect/httpapi/stream/failure` event containing the encoded full `Cause`.
- Client receives `effect/httpapi/stream/failure`, decodes the full cause, and fails the stream with that cause.
- User SSE event named `effect/httpapi/stream/failure` is rejected.
- Server streams bytes and client consumes bytes incrementally.
- Non-success HTTP responses from streaming endpoints still decode through declared endpoint error schemas before returning a stream.
- `responseMode: "response-only"` allows manual `response.stream` consumption.

OpenAPI tests:

- SSE stream response emits `text/event-stream`, `x-effect-stream.encoding = "sse"`, `causeSchema`, and `failureEvent`.
- Byte stream response emits `application/octet-stream`, binary schema, and `x-effect-stream.encoding = "uint8array"`.

Negative tests:

- `HEAD` with streaming success is rejected.
- Mixed buffered and streaming successes for the same status are rejected.
- Multiple streaming successes for the same status are rejected in the initial design.

## Recommended MVP Boundary

Implement these constructors first:

```ts
HttpApiSchema.StreamSse({ events, error })
HttpApiSchema.StreamUint8Array()
```

Defer NDJSON, text streaming, request body streams, and Accept negotiation until there is a concrete use case.
