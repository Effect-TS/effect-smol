/**
 * @since 4.0.0
 */
import { SocketServer } from "@effect/platform/SocketServer"
import type { RpcSerialization } from "../rpc/RpcSerialization.ts"
import * as RpcServer from "../rpc/RpcServer.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as MessageStorage from "./MessageStorage.ts"
import type { RunnerHealth } from "./RunnerHealth.ts"
import * as Runners from "./Runners.ts"
import type { ShardingConfig } from "./ShardingConfig.ts"
import * as ShardManager from "./ShardManager.ts"
import type { ShardStorage } from "./ShardStorage.ts"

const withLogAddress = <A, E, R>(layer: Layer.Layer<A, E, R>): Layer.Layer<A, E, R | SocketServer> =>
  Layer.effectDiscard(Effect.gen(function*() {
    const server = yield* SocketServer
    const address = server.address._tag === "UnixAddress"
      ? server.address.path
      : `${server.address.hostname}:${server.address.port}`
    yield* Effect.annotateLogs(Effect.logInfo(`Listening on: ${address}`), {
      package: "@effect/cluster",
      service: "ShardManager"
    })
  })).pipe(Layer.provideMerge(layer))

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<
  ShardManager.ShardManager,
  never,
  | ShardStorage
  | SocketServer
  | Runners.RpcClientProtocol
  | RpcSerialization
  | RunnerHealth
  | ShardManager.Config
  | ShardingConfig
> = ShardManager.layerServer.pipe(
  withLogAddress,
  Layer.provide(RpcServer.layerProtocolSocketServer),
  Layer.provideMerge(ShardManager.layer),
  Layer.provide(Runners.layerRpc),
  Layer.provide(MessageStorage.layerNoop)
)
