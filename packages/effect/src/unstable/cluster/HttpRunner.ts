/**
 * @since 4.0.0
 */
import type * as HttpApp from "@effect/platform/HttpApp"
import type * as HttpClient from "@effect/platform/HttpClient"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServer from "@effect/platform/HttpServer"
import type * as Socket from "@effect/platform/Socket"
import type * as RpcSerialization from "../rpc/RpcSerialization.ts"
import * as RpcServer from "../rpc/RpcServer.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import type { Scope } from "../../Scope.ts"
import { layerClientProtocolHttp, layerClientProtocolWebsocket } from "./HttpCommon.ts"
import type { MessageStorage } from "./MessageStorage.ts"
import * as Runners from "./Runners.ts"
import * as RunnerServer from "./RunnerServer.ts"
import * as Sharding from "./Sharding.ts"
import type * as ShardingConfig from "./ShardingConfig.ts"
import * as ShardManager from "./ShardManager.ts"
import type { ShardStorage } from "./ShardStorage.ts"
import * as SynchronizedClock from "./SynchronizedClock.ts"

/**
 * @since 4.0.0
 * @category Http App
 */
export const toHttpApp: Effect.Effect<
  HttpApp.Default<never, Scope>,
  never,
  Scope | Sharding.Sharding | RpcSerialization.RpcSerialization | MessageStorage
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(RunnerServer.layerHandlers)
  return yield* RpcServer.toHttpApp(Runners.Rpcs, {
    spanPrefix: "RunnerServer",
    disableTracing: true
  }).pipe(Effect.provide(handlers))
})

/**
 * @since 4.0.0
 * @category Http App
 */
export const toHttpAppWebsocket: Effect.Effect<
  HttpApp.Default<never, Scope>,
  never,
  Scope | Sharding.Sharding | RpcSerialization.RpcSerialization | MessageStorage
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(RunnerServer.layerHandlers)
  return yield* RpcServer.toHttpAppWebsocket(Runners.Rpcs, {
    spanPrefix: "RunnerServer",
    disableTracing: true
  }).pipe(
    Effect.provide(handlers)
  )
})

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerClient: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  ShardingConfig.ShardingConfig | Runners.RpcClientProtocol | MessageStorage | ShardStorage
> = Sharding.layer.pipe(
  Layer.provideMerge(Runners.layerRpc),
  Layer.provideMerge(SynchronizedClock.layer),
  Layer.provide(ShardManager.layerClientRpc)
)

/**
 * A HTTP layer for the `Runners` services, that adds a route to the provided
 * `HttpRouter.Tag`.
 *
 * By default, it uses the `HttpRouter.Default` tag.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layer = <I = HttpRouter.Default>(options: {
  readonly path: HttpRouter.PathInput
  readonly routerTag?: HttpRouter.HttpRouter.TagClass<I, string, any, any>
  readonly logAddress?: boolean | undefined
}): Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | RpcSerialization.RpcSerialization
  | ShardingConfig.ShardingConfig
  | Runners.RpcClientProtocol
  | HttpServer.HttpServer
  | MessageStorage
  | ShardStorage
> => {
  const layer = RunnerServer.layerWithClients.pipe(
    Layer.provide(RpcServer.layerProtocolHttp(options))
  )
  return options.logAddress ? withLogAddress(layer) : layer
}

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerWebsocketOptions = <I = HttpRouter.Default>(options: {
  readonly path: HttpRouter.PathInput
  readonly routerTag?: HttpRouter.HttpRouter.TagClass<I, string, any, any>
  readonly logAddress?: boolean | undefined
}): Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | RpcSerialization.RpcSerialization
  | ShardingConfig.ShardingConfig
  | Runners.RpcClientProtocol
  | HttpServer.HttpServer
  | MessageStorage
  | ShardStorage
> => {
  const layer = RunnerServer.layerWithClients.pipe(
    Layer.provide(RpcServer.layerProtocolWebsocket(options))
  )
  return options.logAddress ? withLogAddress(layer) : layer
}

const withLogAddress = <A, E, R>(layer: Layer.Layer<A, E, R>): Layer.Layer<A, E, R | HttpServer.HttpServer> =>
  Layer.effectDiscard(
    HttpServer.addressFormattedWith((address) =>
      Effect.annotateLogs(Effect.logInfo(`Listening on: ${address}`), {
        package: "@effect/cluster",
        service: "Runner"
      })
    )
  ).pipe(Layer.provideMerge(layer))

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
  | ShardStorage
> = HttpRouter.Default.serve().pipe(
  Layer.provideMerge(layer({ path: "/", logAddress: true })),
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
  | ShardStorage
> = HttpRouter.Default.serve().pipe(
  Layer.provideMerge(layerWebsocketOptions({ path: "/", logAddress: true })),
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
