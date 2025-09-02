/**
 * @since 1.0.0
 */
import type * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MessageStorage from "effect/unstable/cluster/MessageStorage"
import type * as Runners from "effect/unstable/cluster/Runners"
import type { Sharding } from "effect/unstable/cluster/Sharding"
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig"
import * as ShardStorage from "effect/unstable/cluster/ShardStorage"
import * as SocketRunner from "effect/unstable/cluster/SocketRunner"
import * as SqlMessageStorage from "effect/unstable/cluster/SqlMessageStorage"
import * as SqlShardStorage from "effect/unstable/cluster/SqlShardStorage"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import type * as SocketServer from "effect/unstable/socket/SocketServer"
import type { SqlClient } from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import { layerClientProtocol } from "./NodeClusterSocketCommon.js"
import * as NodeSocketServer from "./NodeSocketServer.js"

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
    "sql" extends Storage ? SqlClient : never
  > :
  Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    SocketServer.SocketServerError | Config.ConfigError | ("sql" extends Storage ? SqlError : never),
    "sql" extends Storage ? SqlClient : never
  > =>
{
  const layer: Layer.Layer<any, any, any> = options?.clientOnly
    // client only
    ? Layer.provide(SocketRunner.layerClientOnly, layerClientProtocol)
    // with server
    : Layer.provide(SocketRunner.layer, [layerSocketServer, layerClientProtocol])

  return layer.pipe(
    Layer.provideMerge(
      options?.storage === "sql"
        ? SqlMessageStorage.layer
        : MessageStorage.layerNoop
    ),
    Layer.provide(
      options?.storage === "sql"
        ? options.clientOnly ? Layer.empty : SqlShardStorage.layer
        : ShardStorage.layerNoop
    ),
    Layer.provide(ShardingConfig.layerFromEnv(options?.shardingConfig)),
    Layer.provide(
      options?.serialization === "ndjson" ? RpcSerialization.layerNdjson : RpcSerialization.layerMsgPack
    )
  ) as any
}
