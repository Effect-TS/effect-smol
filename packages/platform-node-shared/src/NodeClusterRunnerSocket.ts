/**
 * @since 1.0.0
 */
import type * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MessageStorage from "effect/unstable/cluster/MessageStorage"
import * as Runners from "effect/unstable/cluster/Runners"
import type * as RunnerStorage from "effect/unstable/cluster/RunnerStorage"
import type { Sharding } from "effect/unstable/cluster/Sharding"
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig"
import * as SocketRunner from "effect/unstable/cluster/SocketRunner"
import * as SqlMessageStorage from "effect/unstable/cluster/SqlMessageStorage"
import * as SqlRunnerStorage from "effect/unstable/cluster/SqlRunnerStorage"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import { Socket } from "effect/unstable/socket/Socket"
import type * as SocketServer from "effect/unstable/socket/SocketServer"
import type { SqlClient } from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import * as NodeSocket from "./NodeSocket.ts"
import * as NodeSocketServer from "./NodeSocketServer.ts"

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerClientProtocol: Layer.Layer<
  Runners.RpcClientProtocol,
  never,
  RpcSerialization.RpcSerialization
> = Layer.effect(Runners.RpcClientProtocol)(
  Effect.gen(function*() {
    const serialization = yield* RpcSerialization.RpcSerialization
    return Effect.fnUntraced(function*(address) {
      const socket = yield* NodeSocket.makeNet({
        host: address.host,
        port: address.port
      })
      return yield* RpcClient.makeProtocolSocket().pipe(
        Effect.provideService(Socket, socket),
        Effect.provideService(RpcSerialization.RpcSerialization, serialization)
      )
    }, Effect.orDie)
  })
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerSocketServer: Layer.Layer<
  SocketServer.SocketServer,
  SocketServer.SocketServerError,
  ShardingConfig.ShardingConfig
> = Effect.gen(function*() {
  const config = yield* ShardingConfig.ShardingConfig
  const listenAddress = config.runnerListenAddress ?? config.runnerAddress
  if (listenAddress === undefined) {
    return yield* Effect.die("layerSocketServer: ShardingConfig.runnerListenAddress is None")
  }
  return NodeSocketServer.layer(listenAddress)
}).pipe(Layer.unwrap)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = <const ClientOnly extends boolean = false, const Storage extends "noop" | "sql" = never>(
  options?: {
    readonly serialization?: "msgpack" | "ndjson" | undefined
    readonly clientOnly?: ClientOnly | undefined
    readonly storage?: Storage | undefined
    readonly shardingConfig?: Partial<ShardingConfig.ShardingConfig["Service"]> | undefined
  }
): ClientOnly extends true ? Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    Config.ConfigError,
    "sql" extends Storage ? SqlClient : RunnerStorage.RunnerStorage
  > :
  Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    SocketServer.SocketServerError | Config.ConfigError | ("sql" extends Storage ? SqlError : never),
    "sql" extends Storage ? SqlClient : RunnerStorage.RunnerStorage
  > =>
{
  const layer: Layer.Layer<any, any, any> = options?.clientOnly
    // client only
    ? Layer.provide(SocketRunner.layerClientOnly, layerClientProtocol)
    // with server
    : Layer.provide(SocketRunner.layer, [layerSocketServer, layerClientProtocol])

  return layer.pipe(
    Layer.provideMerge(
      options?.storage === "sql" ?
        SqlMessageStorage.layer
        : MessageStorage.layerNoop
    ),
    Layer.provide(options?.storage === "sql" ? SqlRunnerStorage.layer : Layer.empty),
    Layer.provide(ShardingConfig.layerFromEnv(options?.shardingConfig)),
    Layer.provide(
      options?.serialization === "ndjson" ? RpcSerialization.layerNdjson : RpcSerialization.layerMsgPack
    )
  ) as any
}
