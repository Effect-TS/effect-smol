import { assert, describe, it } from "@effect/vitest"
import { Context, Effect, Layer, Option, Schema, Stream } from "effect"
import { Headers } from "effect/unstable/http"
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcTest } from "effect/unstable/rpc"

const TestGroup = RpcGroup.make(
  Rpc.make("Echo", { payload: { value: Schema.String }, success: Schema.String }),
  Rpc.make("Counter", {
    payload: { count: Schema.Number },
    success: Schema.Number,
    stream: true
  })
)

const TestHandlers = TestGroup.toLayer({
  Echo: (req) =>
    Effect.gen(function*() {
      yield* Rpc.setResponseHeader("x-echo", req.value)
      yield* Rpc.setAllResponseHeaders({ "x-extra": "1" })
      return req.value
    }),
  Counter: (req) =>
    Stream.range(1, req.count).pipe(
      Stream.tap(() => Rpc.setResponseHeader("x-stream", "on"))
    )
})

const headerValue = (headers: Headers.Headers, key: string): string | undefined =>
  Option.getOrUndefined(Headers.get(headers, key))

describe("Rpc response headers", () => {
  it.effect("server handler sets response headers, client receives them on Exit", () =>
    Effect.gen(function*() {
      const client = yield* RpcTest.makeClient(TestGroup)
      let captured: Headers.Headers | undefined
      const result = yield* client.Echo(
        { value: "hi" },
        {
          onResponseHeadersSync: (h) => {
            captured = h
          }
        }
      )
      assert.strictEqual(result, "hi")
      assert.ok(captured, "headers callback fired")
      assert.strictEqual(headerValue(captured!, "x-echo"), "hi")
      assert.strictEqual(headerValue(captured!, "x-extra"), "1")
    }).pipe(Effect.provide(TestHandlers)))

  it.effect("response headers fire on stream Chunk and Exit", () =>
    Effect.gen(function*() {
      const client = yield* RpcTest.makeClient(TestGroup)
      const captures: Array<Headers.Headers> = []
      const stream = client.Counter(
        { count: 3 },
        {
          onResponseHeadersSync: (h) => {
            captures.push(h)
          }
        }
      )
      const values = yield* Stream.runCollect(stream)
      assert.deepStrictEqual([...values], [1, 2, 3])
      assert.ok(captures.length > 0, "callback fired at least once")
      const last = captures[captures.length - 1]
      assert.strictEqual(headerValue(last, "x-stream"), "on")
    }).pipe(Effect.provide(TestHandlers)))

  it.effect("onResponseHeaders effect runs in client's context, propagates errors", () =>
    Effect.gen(function*() {
      class Sink extends Context.Service<Sink, { record: (h: Headers.Headers) => Effect.Effect<void> }>()(
        "test/Sink"
      ) {}
      const recorded: Array<Headers.Headers> = []
      const SinkLayer = Layer.succeed(Sink)({
        record: (h) =>
          Effect.sync(() => {
            recorded.push(h)
          })
      })

      const client = yield* RpcTest.makeClient(TestGroup)
      const result = yield* client.Echo(
        { value: "yo" },
        {
          onResponseHeaders: (h) => Effect.flatMap(Sink.asEffect(), (s) => s.record(h))
        }
      ).pipe(Effect.provide(SinkLayer))
      assert.strictEqual(result, "yo")
      assert.strictEqual(recorded.length, 1)
      assert.strictEqual(headerValue(recorded[0], "x-echo"), "yo")
    }).pipe(Effect.provide(TestHandlers)))

  it.effect("withResponseHeaders returns [result, headers]", () =>
    Effect.gen(function*() {
      const client = yield* RpcTest.makeClient(TestGroup)
      const [result, headers] = yield* RpcClient.withResponseHeaders(client.Echo({ value: "ok" }))
      assert.strictEqual(result, "ok")
      assert.strictEqual(headerValue(headers, "x-echo"), "ok")
      assert.strictEqual(headerValue(headers, "x-extra"), "1")
    }).pipe(Effect.provide(TestHandlers)))

  it("jsonRpc serialization round-trips response headers on Exit", () => {
    const parser = RpcSerialization.jsonRpc().makeUnsafe()
    parser.decode("{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"foo\"}")
    const encoded = parser.encode({
      _tag: "Exit",
      requestId: "7",
      exit: { _tag: "Success", value: 42 },
      headers: [["x-foo", "bar"]]
    })
    assert.ok(typeof encoded === "string")
    const message = JSON.parse(encoded as string)
    assert.deepStrictEqual(message, {
      jsonrpc: "2.0",
      id: 7,
      result: 42,
      headers: [["x-foo", "bar"]]
    })

    const decoded = parser.decode(encoded as string)
    assert.deepStrictEqual(decoded, [{
      _tag: "Exit",
      requestId: "7",
      exit: { _tag: "Success", value: 42 },
      headers: [["x-foo", "bar"]]
    }])
  })

  it("jsonRpc Exit without headers encodes empty array", () => {
    const parser = RpcSerialization.jsonRpc().makeUnsafe()
    parser.decode("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"foo\"}")
    const encoded = parser.encode({
      _tag: "Exit",
      requestId: "1",
      exit: { _tag: "Success", value: "ok" },
      headers: []
    })
    const message = JSON.parse(encoded as string)
    assert.deepStrictEqual(message.headers, [])
  })
})
