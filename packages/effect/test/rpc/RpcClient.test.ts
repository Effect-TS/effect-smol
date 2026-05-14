import { assert, describe, it } from "@effect/vitest"
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Queue, Schedule, Schema } from "effect"
import { TestClock } from "effect/testing"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/unstable/rpc"
import { RpcClientError } from "effect/unstable/rpc/RpcClientError"
import { type FromClient, RequestId } from "effect/unstable/rpc/RpcMessage"
import { Socket } from "effect/unstable/socket"

const TestGroup = RpcGroup.make(
  Rpc.make("Ping", { success: Schema.String })
)

const LifecycleGroup = RpcGroup.make(
  Rpc.make("Get", { success: Schema.String }),
  Rpc.make("Subscribe", {
    success: Schema.Number,
    error: Schema.String,
    stream: true
  })
)

const makeHttpClient = (body: string): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(body, { status: 200 })
      )
    )
  )

const makeProtocolLayer = (
  serializationLayer: Layer.Layer<RpcSerialization.RpcSerialization>,
  body: string
) =>
  RpcClient.layerProtocolHttp({ url: "http://localhost/rpc" }).pipe(
    Layer.provideMerge(serializationLayer),
    Layer.provideMerge(Layer.succeed(HttpClient.HttpClient, makeHttpClient(body)))
  )

const assertEmptyResponseFailsRequest = (
  serializationLayer: Layer.Layer<RpcSerialization.RpcSerialization>,
  body: string
) =>
  Effect.gen(function*() {
    const client = yield* RpcClient.make(TestGroup).pipe(
      Effect.provide(makeProtocolLayer(serializationLayer, body))
    )

    const cause = yield* client.Ping().pipe(
      Effect.timeout("1 second"),
      Effect.sandbox,
      Effect.flip
    )

    const error = Cause.squash(cause)
    assert.instanceOf(error, RpcClientError)
    assert.strictEqual(error.reason._tag, "RpcClientDefect")
    assert.strictEqual(error.reason.message, "Received empty HTTP response from RPC server")
  })

const makeSocket = (
  written: Array<string>,
  setHandler?: (handler: (message: string) => Effect.Effect<void>) => void
): Socket.Socket =>
  Socket.make({
    runRaw: (handler, options) =>
      Effect.sync(() => {
        setHandler?.((message) => (handler(message) as Effect.Effect<void> | void) ?? Effect.void)
      }).pipe(
        Effect.andThen(options?.onOpen ?? Effect.void),
        Effect.andThen(Effect.never)
      ),
    writer: Effect.succeed((chunk) =>
      Effect.sync(() => {
        written.push(String(chunk))
      })
    )
  })

describe("RpcClient", () => {
  it.effect("fails request on empty HTTP response for unframed serialization", () =>
    assertEmptyResponseFailsRequest(RpcSerialization.layerJson, "[]"))

  it.effect("fails request on empty HTTP response for framed serialization", () =>
    assertEmptyResponseFailsRequest(RpcSerialization.layerNdjson, ""))

  it.effect("runs heartbeat hooks for ping and pong messages", () =>
    Effect.gen(function*() {
      const connected = yield* Deferred.make<void>()
      const written: Array<string> = []
      const events: Array<string> = []
      let emit = (_message: string): Effect.Effect<void> => Effect.void

      yield* RpcClient.makeProtocolSocket().pipe(
        Effect.provideService(
          Socket.Socket,
          makeSocket(written, (handler) => {
            emit = handler
          })
        ),
        Effect.provideService(
          RpcClient.ConnectionHooks,
          RpcClient.ConnectionHooks.of({
            onConnect: Deferred.succeed(connected, void 0),
            onDisconnect: Effect.sync(() => {
              events.push("disconnect")
            }),
            onPing: Effect.sync(() => {
              events.push("ping")
            }),
            onPong: Effect.sync(() => {
              events.push("pong")
            })
          })
        ),
        Effect.provide(RpcSerialization.layerJson)
      )

      yield* Deferred.await(connected)
      yield* TestClock.adjust("5 seconds")
      yield* emit(JSON.stringify({ _tag: "Pong" }))

      assert.deepStrictEqual(events, ["ping", "pong"])
      assert.deepStrictEqual(written.map((message) => JSON.parse(message)), [{ _tag: "Ping" }])
    }).pipe(Effect.scoped) as Effect.Effect<void>)

  it.effect("runs heartbeat hook before failing on ping timeout", () =>
    Effect.gen(function*() {
      const connected = yield* Deferred.make<void>()
      const written: Array<string> = []
      const events: Array<string> = []

      yield* RpcClient.makeProtocolSocket({ retryPolicy: Schedule.recurs(0) }).pipe(
        Effect.provideService(Socket.Socket, makeSocket(written)),
        Effect.provideService(
          RpcClient.ConnectionHooks,
          RpcClient.ConnectionHooks.of({
            onConnect: Deferred.succeed(connected, void 0),
            onDisconnect: Effect.sync(() => {
              events.push("disconnect")
            }),
            onPingTimeout: Effect.sync(() => {
              events.push("timeout")
            })
          })
        ),
        Effect.provide(RpcSerialization.layerJson)
      )

      yield* Deferred.await(connected)
      yield* TestClock.adjust("10 seconds")

      assert.deepStrictEqual(events, ["timeout", "disconnect"])
      assert.deepStrictEqual(written.map((message) => JSON.parse(message)), [{ _tag: "Ping" }])
    }).pipe(Effect.scoped) as Effect.Effect<void>)

  it.effect("runs request lifecycle hooks for effect requests", () =>
    Effect.gen(function*() {
      const sent: Array<FromClient<any>> = []
      const events: Array<string> = []
      const requestSent = yield* Deferred.make<void>()
      const { client, write } = yield* RpcClient.makeNoSerialization(LifecycleGroup, {
        disableTracing: true,
        generateRequestId: () => RequestId(1n),
        onFromClient: ({ message }) =>
          Effect.sync(() => {
            sent.push(message)
          }).pipe(
            Effect.andThen(message._tag === "Request" ? Deferred.succeed(requestSent, void 0) : Effect.void)
          )
      }).pipe(
        Effect.provideService(
          RpcClient.RequestHooks,
          RpcClient.RequestHooks.of({
            onRequestStart: (info) =>
              Effect.sync(() => {
                events.push(`start:${info.id}:${info.tag}:${info.stream}`)
              }),
            onRequestExit: (info) =>
              Effect.sync(() => {
                events.push(`exit:${info.id}:${info.tag}:${info.stream}:${info.exit._tag}`)
              })
          })
        )
      )

      const fiber = yield* Effect.forkScoped((client as any).Get())
      yield* Deferred.await(requestSent)
      yield* write({ _tag: "Exit", clientId: 0, requestId: RequestId(1n), exit: Exit.succeed("ok") })
      const result = yield* Fiber.join(fiber)

      assert.strictEqual(result, "ok")
      assert.deepStrictEqual(events, ["start:1:Get:false", "exit:1:Get:false:Success"])
      assert.deepStrictEqual(sent.map((message) => message._tag), ["Request"])
    }).pipe(Effect.scoped) as Effect.Effect<void>)

  it.effect("runs request lifecycle hooks for stream chunks and exits", () =>
    Effect.gen(function*() {
      const sent: Array<FromClient<any>> = []
      const events: Array<string> = []
      let nextRequestId = 1n
      const { client, write } = yield* RpcClient.makeNoSerialization(LifecycleGroup, {
        disableTracing: true,
        generateRequestId: () => RequestId(nextRequestId++),
        onFromClient: ({ message }) =>
          Effect.sync(() => {
            sent.push(message)
          })
      }).pipe(
        Effect.provideService(
          RpcClient.RequestHooks,
          RpcClient.RequestHooks.of({
            onRequestStart: (info) =>
              Effect.sync(() => {
                events.push(`start:${info.id}:${info.tag}:${info.stream}`)
              }),
            onRequestChunk: (info) =>
              Effect.sync(() => {
                events.push(`chunk:${info.id}:${info.tag}:${info.chunkCount}`)
              }),
            onRequestExit: (info) =>
              Effect.sync(() => {
                events.push(`exit:${info.id}:${info.tag}:${info.stream}:${info.exit._tag}`)
              })
          })
        )
      )

      const queue = yield* (client as any).Subscribe(undefined, { asQueue: true })
      yield* write({ _tag: "Chunk", clientId: 0, requestId: RequestId(1n), values: [1] as any })
      const value = yield* Queue.take(queue)
      yield* write({ _tag: "Exit", clientId: 0, requestId: RequestId(1n), exit: Exit.succeed(void 0) })

      assert.strictEqual(value, 1)
      assert.strictEqual(
        events.join("|"),
        [
          "start:1:Subscribe:true",
          "chunk:1:Subscribe:1",
          "exit:1:Subscribe:true:Success"
        ].join("|")
      )
      assert.deepStrictEqual(sent.map((message) => message._tag), ["Request", "Ack"])
    }).pipe(Effect.scoped) as Effect.Effect<void>)

  it.effect("runs request lifecycle hook for interrupts", () =>
    Effect.gen(function*() {
      const sent: Array<FromClient<any>> = []
      const events: Array<string> = []
      const requestSent = yield* Deferred.make<void>()
      const { client } = yield* RpcClient.makeNoSerialization(LifecycleGroup, {
        disableTracing: true,
        generateRequestId: () => RequestId(1n),
        onFromClient: ({ message }) =>
          Effect.sync(() => {
            sent.push(message)
          }).pipe(
            Effect.andThen(message._tag === "Request" ? Deferred.succeed(requestSent, void 0) : Effect.void)
          )
      }).pipe(
        Effect.provideService(
          RpcClient.RequestHooks,
          RpcClient.RequestHooks.of({
            onRequestStart: (info) =>
              Effect.sync(() => {
                events.push(`start:${info.id}:${info.tag}:${info.stream}`)
              }),
            onRequestInterrupt: (info) =>
              Effect.sync(() => {
                events.push(`interrupt:${info.id}:${info.tag}`)
              })
          })
        )
      )

      yield* Effect.scoped(Effect.gen(function*() {
        yield* (client as any).Subscribe(undefined, { asQueue: true })
        yield* Deferred.await(requestSent)
      }))

      assert.deepStrictEqual(events, ["start:1:Subscribe:true", "interrupt:1:Subscribe"])
      assert.deepStrictEqual(sent.map((message) => message._tag), ["Request", "Interrupt"])
    }).pipe(Effect.scoped) as Effect.Effect<void>)
})
