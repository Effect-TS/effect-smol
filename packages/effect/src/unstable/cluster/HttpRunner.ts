/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import type { Scope } from "../../Scope.ts"
import type * as HttpClient from "../http/HttpClient.ts"
import * as HttpRouter from "../http/HttpRouter.ts"
import type * as HttpServer from "../http/HttpServer.ts"
import type { HttpServerRequest } from "../http/HttpServerRequest.ts"
import type { HttpServerResponse } from "../http/HttpServerResponse.ts"
import type * as RpcSerialization from "../rpc/RpcSerialization.ts"
import * as RpcServer from "../rpc/RpcServer.ts"
import type * as Socket from "../socket/Socket.ts"
import { layerClientProtocolHttp, layerClientProtocolWebsocket } from "./HttpCommon.ts"
import type { MessageStorage } from "./MessageStorage.ts"
import * as Runners from "./Runners.ts"
import * as RunnerServer from "./RunnerServer.ts"
import type { RunnerStorage } from "./RunnerStorage.ts"
import * as Sharding from "./Sharding.ts"
import type * as ShardingConfig from "./ShardingConfig.ts"
import * as SynchronizedClock from "./SynchronizedClock.ts"

/**
 * @since 4.0.0
 * @category Http App
 */
export const toHttpEffect: Effect.Effect<
  Effect.Effect<HttpServerResponse, never, Scope | HttpServerRequest>,
  never,
  Scope | RpcSerialization.RpcSerialization | Sharding.Sharding | MessageStorage
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(RunnerServer.layerHandlers)
  return yield* RpcServer.toHttpEffect(Runners.Rpcs, {
    spanPrefix: "RunnerServer",
    disableTracing: true
  }).pipe(Effect.provideServices(handlers))
})

/**
 * @since 4.0.0
 * @category Http App
 */
export const toHttpEffectWebsocket: Effect.Effect<
  Effect.Effect<HttpServerResponse, never, Scope | HttpServerRequest>,
  never,
  Scope | RpcSerialization.RpcSerialization | Sharding.Sharding | MessageStorage
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(RunnerServer.layerHandlers)
  return yield* RpcServer.toHttpEffectWebsocket(Runners.Rpcs, {
    spanPrefix: "RunnerServer",
    disableTracing: true
  }).pipe(Effect.provideServices(handlers))
})

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerClient: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  ShardingConfig.ShardingConfig | Runners.RpcClientProtocol | MessageStorage | RunnerStorage
> = Sharding.layer.pipe(
  Layer.provideMerge(Runners.layerRpc),
  Layer.provideMerge(SynchronizedClock.layer)
)

/**
 * A HTTP layer for the `Runners` services, that adds a route to the provided
 * `HttpRouter`.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerHttpOptions = (options: {
  readonly path: HttpRouter.PathInput
}): Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | RunnerStorage
  | RpcSerialization.RpcSerialization
  | MessageStorage
  | ShardingConfig.ShardingConfig
  | Runners.RpcClientProtocol
  | HttpRouter.HttpRouter
> =>
  RunnerServer.layerWithClients.pipe(
    Layer.provide(RpcServer.layerProtocolHttp(options))
  )

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerWebsocketOptions = (options: {
  readonly path: HttpRouter.PathInput
}): Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | ShardingConfig.ShardingConfig
  | Runners.RpcClientProtocol
  | MessageStorage
  | RunnerStorage
  | RpcSerialization.RpcSerialization
  | HttpRouter.HttpRouter
> =>
  RunnerServer.layerWithClients.pipe(
    Layer.provide(RpcServer.layerProtocolWebsocket(options))
  )

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerHttp: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | RpcSerialization.RpcSerialization
  | ShardingConfig.ShardingConfig
  | HttpClient.HttpClient
  | HttpServer.HttpServer
  | MessageStorage
  | RunnerStorage
> = HttpRouter.serve(layerHttpOptions({ path: "/" })).pipe(
  Layer.provide(layerClientProtocolHttp({ path: "/" }))
)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerHttpClientOnly: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | RpcSerialization.RpcSerialization
  | ShardingConfig.ShardingConfig
  | HttpClient.HttpClient
  | MessageStorage
> = RunnerServer.layerClientOnly.pipe(
  Layer.provide(layerClientProtocolHttp({ path: "/" }))
)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerWebsocket: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | RpcSerialization.RpcSerialization
  | ShardingConfig.ShardingConfig
  | Socket.WebSocketConstructor
  | HttpServer.HttpServer
  | MessageStorage
  | RunnerStorage
> = HttpRouter.serve(layerWebsocketOptions({ path: "/" })).pipe(
  Layer.provide(layerClientProtocolWebsocket({ path: "/" }))
)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerWebsocketClientOnly: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  ShardingConfig.ShardingConfig | MessageStorage | RpcSerialization.RpcSerialization | Socket.WebSocketConstructor
> = RunnerServer.layerClientOnly.pipe(
  Layer.provide(layerClientProtocolWebsocket({ path: "/" }))
)
