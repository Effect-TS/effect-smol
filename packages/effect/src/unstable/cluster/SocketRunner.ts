/**
 * @since 4.0.0
 */
import { SocketServer } from "@effect/platform/SocketServer"
import type * as RpcSerialization from "../rpc/RpcSerialization.ts"
import * as RpcServer from "../rpc/RpcServer.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import type { MessageStorage } from "./MessageStorage.ts"
import type * as Runners from "./Runners.ts"
import * as RunnerServer from "./RunnerServer.ts"
import type * as Sharding from "./Sharding.ts"
import type { ShardingConfig } from "./ShardingConfig.ts"
import type * as ShardStorage from "./ShardStorage.ts"

const withLogAddress = <A, E, R>(layer: Layer.Layer<A, E, R>): Layer.Layer<A, E, R | SocketServer> =>
  Layer.effectDiscard(Effect.gen(function*() {
    const server = yield* SocketServer
    const address = server.address._tag === "UnixAddress"
      ? server.address.path
      : `${server.address.hostname}:${server.address.port}`
    yield* Effect.annotateLogs(Effect.logInfo(`Listening on: ${address}`), {
      package: "@effect/cluster",
      service: "Runner"
    })
  })).pipe(Layer.provideMerge(layer))

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | Runners.RpcClientProtocol
  | ShardingConfig
  | RpcSerialization.RpcSerialization
  | SocketServer
  | MessageStorage
  | ShardStorage.ShardStorage
> = RunnerServer.layerWithClients.pipe(
  withLogAddress,
  Layer.provide(RpcServer.layerProtocolSocketServer)
)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerClientOnly: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  Runners.RpcClientProtocol | ShardingConfig | MessageStorage
> = RunnerServer.layerClientOnly
