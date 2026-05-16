import { NodeHttpServer, NodeSocket, NodeSocketServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Cause, Deferred, Effect, Layer, Schema } from "effect"
import { Entity, EntityProxy, EntityProxyServer, Sharding } from "effect/unstable/cluster"
import { HttpBody, HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi"
import { Rpc, RpcClient, RpcSerialization, RpcServer, RpcTest } from "effect/unstable/rpc"
import { SocketServer } from "effect/unstable/socket"
import { e2eSuite, UsersClient } from "./fixtures/rpc-e2e.ts"
import { RpcLive, User } from "./fixtures/rpc-schemas.ts"

describe("RpcServer", () => {
  // http ndjson
  const HttpProtocol = RpcServer.layerProtocolHttp({ path: "/rpc" }).pipe(
    Layer.provide(HttpRouter.layer)
  )
  const HttpNdjsonServer = RpcLive.pipe(
    Layer.provideMerge(HttpProtocol),
    Layer.provide(HttpRouter.serve(HttpProtocol, { disableListenLog: true, disableLogger: true }))
  )
  const HttpNdjsonClient = UsersClient.layer.pipe(
    Layer.provide(
      RpcClient.layerProtocolHttp({
        url: "",
        transformClient: HttpClient.mapRequest(HttpClientRequest.appendUrl("/rpc"))
      })
    )
  )
  const CustomDefectLayer = HttpNdjsonClient.pipe(
    Layer.provideMerge(HttpNdjsonServer),
    Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerNdjson])
  )
  e2eSuite(
    "e2e http ndjson",
    HttpNdjsonClient.pipe(
      Layer.provideMerge(HttpNdjsonServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerNdjson])
    )
  )
  e2eSuite(
    "e2e http msgpack",
    HttpNdjsonClient.pipe(
      Layer.provideMerge(HttpNdjsonServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerMsgPack])
    )
  )
  e2eSuite(
    "e2e http jsonrpc",
    HttpNdjsonClient.pipe(
      Layer.provideMerge(HttpNdjsonServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerNdJsonRpc()])
    )
  )

  // websocket
  const WsProtocol = RpcServer.layerProtocolWebsocket({ path: "/rpc" }).pipe(
    Layer.provide(HttpRouter.layer)
  )
  const HttpWsServer = RpcLive.pipe(
    Layer.provideMerge(WsProtocol),
    Layer.provide(HttpRouter.serve(WsProtocol, { disableListenLog: true, disableLogger: true }))
  )
  const HttpWsClient = UsersClient.layer.pipe(
    Layer.provide(RpcClient.layerProtocolSocket()),
    Layer.provide(
      Effect.gen(function*() {
        const server = yield* HttpServer.HttpServer
        const address = server.address as HttpServer.TcpAddress
        return NodeSocket.layerWebSocket(`http://127.0.0.1:${address.port}/rpc`)
      }).pipe(Layer.unwrap)
    )
  )
  e2eSuite(
    "e2e ws ndjson",
    HttpWsClient.pipe(
      Layer.provideMerge(HttpWsServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerNdjson])
    )
  )
  e2eSuite(
    "e2e ws json",
    HttpWsClient.pipe(
      Layer.provideMerge(HttpWsServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerJson])
    )
  )
  e2eSuite(
    "e2e ws msgpack",
    HttpWsClient.pipe(
      Layer.provideMerge(HttpWsServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerMsgPack])
    )
  )
  e2eSuite(
    "e2e ws jsonrpc",
    HttpWsClient.pipe(
      Layer.provideMerge(HttpWsServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerJsonRpc()])
    )
  )

  // tcp
  const TcpServer = RpcLive.pipe(
    Layer.provideMerge(RpcServer.layerProtocolSocketServer),
    Layer.provideMerge(NodeSocketServer.layer({ port: 0 }))
  )
  const TcpClient = UsersClient.layer.pipe(
    Layer.provide(RpcClient.layerProtocolSocket()),
    Layer.provide(
      Effect.gen(function*() {
        const server = yield* SocketServer.SocketServer
        const address = server.address as SocketServer.TcpAddress
        return NodeSocket.layerNet({ port: address.port })
      }).pipe(Layer.unwrap)
    )
  )
  e2eSuite(
    "e2e tcp ndjson",
    TcpClient.pipe(
      Layer.provideMerge(TcpServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerNdjson])
    )
  )
  e2eSuite(
    "e2e tcp msgpack",
    TcpClient.pipe(
      Layer.provideMerge(TcpServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerMsgPack])
    )
  )
  e2eSuite(
    "e2e tcp jsonrpc",
    TcpClient.pipe(
      Layer.provideMerge(TcpServer),
      Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerNdJsonRpc()])
    )
  )

  // worker
  // const WorkerClient = UsersClient.layer.pipe(
  //   Layer.provide(RpcClient.layerProtocolWorker({ size: 1 })),
  //   Layer.provide(
  //     NodeWorker.layerPlatform(() =>
  //       CP.fork(new URL("./fixtures/rpc-worker.ts", import.meta.url), {
  //         execPath: "node"
  //       })
  //     )
  //   ),
  //   Layer.merge(Layer.succeed(RpcServer.Protocol, {
  //     supportsAck: true
  //   } as any))
  // )
  // e2eSuite("e2e worker", WorkerClient)

  describe("RpcTest", () => {
    it.effect("works", () =>
      Effect.gen(function*() {
        const client = yield* UsersClient
        const user = yield* client.GetUser({ id: "1" })
        assert.deepStrictEqual(user, new User({ id: "1", name: "Logged in user" }))
      }).pipe(Effect.provide(UsersClient.layerTest)))
  })

  describe("custom defect schema", () => {
    it.effect("preserves full defect with custom schema", () =>
      Effect.gen(function*() {
        const client = yield* UsersClient
        const cause = yield* client.ProduceDefectCustom().pipe(
          Effect.sandbox,
          Effect.flip
        )
        const defect = Cause.squash(cause)
        assert.instanceOf(defect, Error)
        assert.strictEqual(defect.name, "CustomDefect")
        assert.strictEqual(defect.message, "detailed error")
        assert.strictEqual(defect.stack, "Error: detailed error\n  at handler.ts:1")
      }).pipe(Effect.provide(CustomDefectLayer)))
  })

  describe("entity proxy", () => {
    it.effect("provides handler context for generated rpc handlers", () =>
      Effect.gen(function*() {
        const TestEntity = Entity.make("TestEntity", [Rpc.make("NoPayload")])
        const TestEntityRpcs = EntityProxy.toRpcGroup(TestEntity)
        const called = yield* Deferred.make<void>()
        const testClient = (entityId: string) => ({
          NoPayload: (payload: void, options?: { readonly discard?: boolean }) =>
            Effect.gen(function*() {
              assert.strictEqual(entityId, "id")
              assert.strictEqual(payload, undefined)
              assert.strictEqual(options?.discard, true)
              yield* Deferred.succeed(called, undefined)
            })
        })
        const sharding = Sharding.Sharding.of({
          ...({} as Sharding.Sharding["Service"]),
          isShutdown: Effect.succeed(false),
          makeClient: () => Effect.succeed(testClient) as never,
          pollStorage: Effect.void
        })

        const client = yield* RpcTest.makeClient(TestEntityRpcs).pipe(
          Effect.provide(EntityProxyServer.layerRpcHandlers(TestEntity)),
          Effect.provideService(Sharding.Sharding, sharding)
        )

        yield* client["TestEntity.NoPayloadDiscard"]({
          entityId: "id",
          payload: undefined
        })
        yield* Deferred.await(called)
      }))

    it.effect("layerHttpApi correctly passes path params to entity client", () => {
      const Ping = Rpc.make("Ping", {
        payload: { value: Schema.String },
        success: Schema.Struct({ entityId: Schema.String, value: Schema.String })
      })
      const PingEntity = Entity.make("PingEntity", [Ping])

      const PingGroup = EntityProxy.toHttpApiGroup("ping", PingEntity).prefix("/ping")
      const PingApi = HttpApi.make("ping-api").add(PingGroup)

      const testClient = (entityId: string) => ({
        Ping: (payload: { value: string }) =>
          Effect.succeed({ entityId, value: payload.value })
      })
      const sharding = Sharding.Sharding.of({
        ...({} as Sharding.Sharding["Service"]),
        isShutdown: Effect.succeed(false),
        makeClient: () => Effect.succeed(testClient) as never,
        pollStorage: Effect.void
      })

      const ApiHandlers = EntityProxyServer.layerHttpApi(PingApi, "ping", PingEntity)
      const AppLayer = HttpApiBuilder.layer(PingApi).pipe(Layer.provide(ApiHandlers))
      const ServerLive = HttpRouter.serve(AppLayer, {
        disableListenLog: true,
        disableLogger: true
      }).pipe(
        Layer.provideMerge(NodeHttpServer.layerTest),
        Layer.provideService(Sharding.Sharding, sharding)
      )

      return Effect.gen(function*() {
        const res = yield* HttpClient.post("/ping/ping/test-entity-123", {
          body: HttpBody.jsonUnsafe({ value: "hello" })
        })
        assert.strictEqual(res.status, 200)
        const body = yield* res.json
        assert.deepStrictEqual(body, { entityId: "test-entity-123", value: "hello" })
      }).pipe(Effect.provide(ServerLive))
    })
  })
})
