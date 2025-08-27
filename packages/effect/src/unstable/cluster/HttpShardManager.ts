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
import * as MessageStorage from "./MessageStorage.ts"
import * as RunnerHealth from "./RunnerHealth.ts"
import * as Runners from "./Runners.ts"
import type { ShardingConfig } from "./ShardingConfig.ts"
import * as ShardManager from "./ShardManager.ts"
import type { ShardStorage } from "./ShardStorage.ts"

/**
 * @since 4.0.0
 * @category Http App
 */
export const toHttpEffect: Effect.Effect<
  Effect.Effect<HttpServerResponse, never, Scope | HttpServerRequest>,
  never,
  Scope | RpcSerialization.RpcSerialization | ShardManager.ShardManager
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(ShardManager.layerServerHandlers)
  return yield* RpcServer.toHttpEffect(ShardManager.Rpcs).pipe(
    Effect.provideServices(handlers)
  )
})

/**
 * @since 4.0.0
 * @category Http App
 */
export const toHttpAppWebsocket: Effect.Effect<
  Effect.Effect<HttpServerResponse, never, Scope | HttpServerRequest>,
  never,
  Scope | RpcSerialization.RpcSerialization | ShardManager.ShardManager
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(ShardManager.layerServerHandlers)
  return yield* RpcServer.toHttpEffectWebsocket(ShardManager.Rpcs).pipe(
    Effect.provideServices(handlers)
  )
})

/**
 * A layer for the `ShardManager` service, that does not run a server.
 *
 * It only provides the `Runners` rpc client.
 *
 * You can use this with the `toHttpEffect` and `toHttpEffectWebsocket` apis
 * to run a complete `ShardManager` server.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerNoServerHttp = (
  options: {
    readonly runnerPath: string
    readonly runnerHttps?: boolean | undefined
  }
): Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | HttpClient.HttpClient
  | ShardManager.Config
  | ShardingConfig
> =>
  ShardManager.layer.pipe(
    Layer.provide(Runners.layerRpc.pipe(
      Layer.provide([
        layerClientProtocolHttp({
          path: options.runnerPath,
          https: options.runnerHttps
        }),
        MessageStorage.layerNoop
      ])
    ))
  )

/**
 * A layer for the `ShardManager` service, that does not run a server.
 *
 * It only provides the `Runners` rpc client.
 *
 * You can use this with the `toHttpEffect` and `toHttpEffectWebsocket` apis
 * to run a complete `ShardManager` server.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerNoServerWebsocket = (
  options: {
    readonly runnerPath: string
    readonly runnerHttps?: boolean | undefined
  }
): Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | Socket.WebSocketConstructor
  | ShardManager.Config
  | ShardingConfig
> =>
  ShardManager.layer.pipe(
    Layer.provide(Runners.layerRpc.pipe(
      Layer.provide([
        layerClientProtocolWebsocket({
          path: options.runnerPath,
          https: options.runnerHttps
        }),
        MessageStorage.layerNoop
      ])
    ))
  )

/**
 * A HTTP layer for the `ShardManager` server, that adds a route to the provided
 * `HttpRouter`.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerHttpOptions = (
  options: {
    readonly path: HttpRouter.PathInput
    readonly runnerPath: string
    readonly runnerHttps?: boolean | undefined
  }
): Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | HttpClient.HttpClient
  | ShardManager.Config
  | ShardingConfig
  | HttpRouter.HttpRouter
> =>
  ShardManager.layerServer.pipe(
    Layer.provide(RpcServer.layerProtocolHttp(options)),
    Layer.provideMerge(layerNoServerHttp(options))
  )

/**
 * A WebSocket layer for the `ShardManager` server, that adds a route to the provided
 * `HttpRouter.Tag`.
 *
 * By default, it uses the `HttpRouter.Default` tag.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerWebsocketOptions = (
  options: {
    readonly path: HttpRouter.PathInput
    readonly runnerPath: string
    readonly runnerHttps?: boolean | undefined
  }
): Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | HttpRouter.HttpRouter
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | Socket.WebSocketConstructor
  | ShardManager.Config
  | ShardingConfig
> =>
  ShardManager.layerServer.pipe(
    Layer.provide(RpcServer.layerProtocolWebsocket(options)),
    Layer.provideMerge(layerNoServerWebsocket(options))
  )

/**
 * A HTTP layer for the `ShardManager` server, that adds a route to the provided
 * `HttpRouter.Tag`.
 *
 * By default, it uses the `HttpRouter.Default` tag.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerHttp: Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | HttpClient.HttpClient
  | HttpServer.HttpServer
  | ShardManager.Config
  | ShardingConfig
> = HttpRouter.serve(layerHttpOptions({ path: "/", runnerPath: "/" }))

/**
 * A Websocket layer for the `ShardManager` server, that adds a route to the provided
 * `HttpRouter.Tag`.
 *
 * By default, it uses the `HttpRouter.Default` tag.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerWebsocket: Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | Socket.WebSocketConstructor
  | HttpServer.HttpServer
  | ShardManager.Config
  | ShardingConfig
> = HttpRouter.serve(layerWebsocketOptions({ path: "/", runnerPath: "/" }))

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerRunnerHealthHttp: Layer.Layer<
  RunnerHealth.RunnerHealth,
  never,
  RpcSerialization.RpcSerialization | HttpClient.HttpClient | ShardingConfig
> = Layer.provide(RunnerHealth.layerRpc, layerClientProtocolHttp({ path: "/" }))

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerRunnerHealthWebsocket: Layer.Layer<
  RunnerHealth.RunnerHealth,
  never,
  RpcSerialization.RpcSerialization | Socket.WebSocketConstructor | ShardingConfig
> = Layer.provide(RunnerHealth.layerRpc, layerClientProtocolWebsocket({ path: "/" }))
