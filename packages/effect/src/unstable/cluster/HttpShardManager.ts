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
import { identity } from "../../Function.ts"
import * as Layer from "../../Layer.ts"
import type { Scope } from "../../Scope.ts"
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
export const toHttpApp: Effect.Effect<
  HttpApp.Default<never, Scope>,
  never,
  Scope | RpcSerialization.RpcSerialization | ShardManager.ShardManager
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(ShardManager.layerServerHandlers)
  return yield* RpcServer.toHttpApp(ShardManager.Rpcs).pipe(
    Effect.provide(handlers)
  )
})

/**
 * @since 4.0.0
 * @category Http App
 */
export const toHttpAppWebsocket: Effect.Effect<
  HttpApp.Default<never, Scope>,
  never,
  Scope | RpcSerialization.RpcSerialization | ShardManager.ShardManager
> = Effect.gen(function*() {
  const handlers = yield* Layer.build(ShardManager.layerServerHandlers)
  return yield* RpcServer.toHttpAppWebsocket(ShardManager.Rpcs).pipe(
    Effect.provide(handlers)
  )
})

/**
 * A layer for the `ShardManager` service, that does not run a server.
 *
 * It only provides the `Runners` rpc client.
 *
 * You can use this with the `toHttpApp` and `toHttpAppWebsocket` apis
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
 * You can use this with the `toHttpApp` and `toHttpAppWebsocket` apis
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
 * `HttpRouter.Tag`.
 *
 * By default, it uses the `HttpRouter.Default` tag.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerHttpOptions = <I = HttpRouter.Default>(
  options: {
    readonly path: HttpRouter.PathInput
    readonly routerTag?: HttpRouter.HttpRouter.TagClass<I, string, any, any>
    readonly runnerPath: string
    readonly runnerHttps?: boolean | undefined
    readonly logAddress?: boolean | undefined
  }
): Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | HttpClient.HttpClient
  | HttpServer.HttpServer
  | ShardManager.Config
  | ShardingConfig
> => {
  const routerTag = options.routerTag ?? HttpRouter.Default
  return routerTag.serve().pipe(
    options.logAddress ? withLogAddress : identity,
    Layer.merge(ShardManager.layerServer),
    Layer.provide(RpcServer.layerProtocolHttp(options)),
    Layer.provideMerge(layerNoServerHttp(options))
  )
}

/**
 * A WebSocket layer for the `ShardManager` server, that adds a route to the provided
 * `HttpRouter.Tag`.
 *
 * By default, it uses the `HttpRouter.Default` tag.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerWebsocketOptions = <I = HttpRouter.Default>(
  options: {
    readonly path: HttpRouter.PathInput
    readonly routerTag?: HttpRouter.HttpRouter.TagClass<I, string, any, any>
    readonly runnerPath: string
    readonly runnerHttps?: boolean | undefined
    readonly logAddress?: boolean | undefined
  }
): Layer.Layer<
  ShardManager.ShardManager,
  never,
  | RpcSerialization.RpcSerialization
  | ShardStorage
  | RunnerHealth.RunnerHealth
  | HttpServer.HttpServer
  | Socket.WebSocketConstructor
  | ShardManager.Config
  | ShardingConfig
> => {
  const routerTag = options.routerTag ?? HttpRouter.Default
  return routerTag.serve().pipe(
    options.logAddress ? withLogAddress : identity,
    Layer.merge(ShardManager.layerServer),
    Layer.provide(RpcServer.layerProtocolWebsocket(options)),
    Layer.provideMerge(layerNoServerWebsocket(options))
  )
}

const withLogAddress = <A, E, R>(layer: Layer.Layer<A, E, R>): Layer.Layer<A, E, R | HttpServer.HttpServer> =>
  Layer.effectDiscard(
    HttpServer.addressFormattedWith((address) =>
      Effect.annotateLogs(Effect.logInfo(`Listening on: ${address}`), {
        package: "@effect/cluster",
        service: "ShardManager"
      })
    )
  ).pipe(Layer.provideMerge(layer))

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
> = layerHttpOptions({ path: "/", runnerPath: "/" })

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
> = layerWebsocketOptions({ path: "/", runnerPath: "/" })

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
