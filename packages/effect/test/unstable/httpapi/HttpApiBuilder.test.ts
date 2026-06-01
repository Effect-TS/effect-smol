import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect, Schema, Stream } from "effect"
import { HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"

const textDecoder = new TextDecoder()

const StreamError = Schema.Struct({ reason: Schema.String })

const request = HttpServerRequest.fromWeb(new Request("http://localhost/test"))

function runEndpoint<Handler>(
  api: any,
  groupName: string,
  endpointName: string,
  handler: Handler
): Effect.Effect<HttpServerResponse.HttpServerResponse, unknown> {
  return Effect.gen(function*() {
    const effect = yield* (HttpApiBuilder.endpoint as any)(api, groupName, endpointName, handler)
    return yield* effect.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
      Effect.provideService(HttpRouter.RouteContext, { route: undefined as any, params: {} })
    )
  }) as Effect.Effect<HttpServerResponse.HttpServerResponse, unknown>
}

function streamBody(response: HttpServerResponse.HttpServerResponse): Stream.Stream<Uint8Array, unknown> {
  assert.strictEqual(response.body._tag, "Stream")
  if (response.body._tag === "Stream") {
    return response.body.stream
  }
  throw new Error("expected stream body")
}

describe("HttpApiBuilder streaming success responses", () => {
  it.effect("emits StreamUint8Array handler responses as streamed bytes with the declared content type", () =>
    Effect.gen(function*() {
      const Api = HttpApi.make("Api").add(
        HttpApiGroup.make("test").add(
          HttpApiEndpoint.get("download", "/test", {
            success: HttpApiSchema.status(206)(
              HttpApiSchema.StreamUint8Array({ contentType: "application/custom-bytes" })
            )
          })
        )
      )

      const response = yield* runEndpoint(
        Api,
        "test",
        "download",
        () => Effect.succeed(Stream.make(new Uint8Array([1, 2]), new Uint8Array([3])))
      )

      assert.strictEqual(response.status, 206)
      assert.strictEqual(response.headers["content-type"], "application/custom-bytes")
      const chunks = yield* streamBody(response).pipe(Stream.runCollect)
      assert.deepStrictEqual(Array.from(chunks, (chunk) => Array.from(chunk)), [[1, 2], [3]])
    }))

  it.effect("renders successful StreamSse events incrementally with the declared content type", () =>
    Effect.gen(function*() {
      const Events = Schema.Struct({
        event: Schema.String,
        data: Schema.String
      })
      const Api = HttpApi.make("Api").add(
        HttpApiGroup.make("test").add(
          HttpApiEndpoint.get("events", "/test", {
            success: HttpApiSchema.status(202)(
              HttpApiSchema.StreamSse({
                contentType: "text/event-stream; charset=utf-8",
                events: Events,
                error: StreamError
              })
            )
          })
        )
      )

      const response = yield* runEndpoint(Api, "test", "events", () =>
        Effect.succeed(Stream.make(
          { event: "first" as const, data: "one" },
          { event: "second" as const, data: "two" }
        )))

      assert.strictEqual(response.status, 202)
      assert.strictEqual(response.headers["content-type"], "text/event-stream; charset=utf-8")
      const chunks = yield* streamBody(response).pipe(Stream.runCollect)
      assert.deepStrictEqual(
        Array.from(chunks, (chunk) => textDecoder.decode(chunk)),
        ["event: first\ndata: one\n\n", "event: second\ndata: two\n\n"]
      )
    }))

  it.effect("renders StreamSse failures as one reserved event containing an encoded full cause", () =>
    Effect.gen(function*() {
      const Events = Schema.Struct({
        event: Schema.Literal("message"),
        data: Schema.String
      })
      const Api = HttpApi.make("Api").add(
        HttpApiGroup.make("test").add(
          HttpApiEndpoint.get("events", "/test", {
            success: HttpApiSchema.StreamSse({ events: Events, error: StreamError })
          })
        )
      )

      const response = yield* runEndpoint(Api, "test", "events", () => Effect.succeed(Stream.fail({ reason: "boom" })))

      assert.strictEqual(response.headers["content-type"], "text/event-stream")
      const chunks = yield* streamBody(response).pipe(Stream.runCollect)
      const rendered = Array.from(chunks, (chunk) => textDecoder.decode(chunk))
      assert.strictEqual(rendered.length, 1)
      assert.isTrue(rendered[0]!.startsWith("event: effect/httpapi/stream/failure\ndata: "))
      assert.isTrue(rendered[0]!.endsWith("\n\n"))

      const data = rendered[0]!.split("\n")[1]!.slice("data: ".length)
      const cause = yield* Schema.decodeUnknownEffect(Schema.toCodecJson(Schema.Cause(StreamError, Schema.Defect)))(
        JSON.parse(data)
      )
      assert.deepStrictEqual(cause, Cause.fail({ reason: "boom" }))
    }))

  it.effect("rejects successful StreamSse user events that use the reserved failure event name", () =>
    Effect.gen(function*() {
      const Events = Schema.Struct({
        event: Schema.String,
        data: Schema.String
      })
      const Api = HttpApi.make("Api").add(
        HttpApiGroup.make("test").add(
          HttpApiEndpoint.get("events", "/test", {
            success: HttpApiSchema.StreamSse({ events: Events, error: StreamError })
          })
        )
      )

      const response = yield* runEndpoint(Api, "test", "events", () =>
        Effect.succeed(Stream.make({
          event: "effect/httpapi/stream/failure",
          data: "not allowed"
        })))

      const exit = yield* streamBody(response).pipe(Stream.runCollect, Effect.exit)
      assert.strictEqual(exit._tag, "Failure")
    }))
})
