/**
 * @since 1.0.0
 */
import type * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as RunnerHealth from "effect/unstable/cluster/RunnerHealth"
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig"
import * as ShardManager from "effect/unstable/cluster/ShardManager"
import * as ShardStorage from "effect/unstable/cluster/ShardStorage"
import * as SocketShardManager from "effect/unstable/cluster/SocketShardManager"
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
  return NodeSocketServer.layer(config.shardManagerAddress)
}).pipe(Layer.unwrap)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = <const Storage extends "sql" | "noop" = never>(options?: {
  readonly serialization?: "msgpack" | "ndjson" | undefined
  readonly shardingConfig?: Partial<ShardingConfig.ShardingConfig["Service"]> | undefined
  readonly storage?: Storage | undefined
  readonly config?: Partial<ShardManager.Config["Service"]> | undefined
}): Layer.Layer<
  ShardManager.ShardManager,
  SocketServer.SocketServerError | Config.ConfigError | ("sql" extends Storage ? SqlError : never),
  "sql" extends Storage ? SqlClient : never
> =>
  SocketShardManager.layer.pipe(
    Layer.provide([
      RunnerHealth.layerRpc,
      layerSocketServer,
      ShardManager.layerConfigFromEnv(options?.config)
    ]),
    Layer.provide(layerClientProtocol),
    Layer.provide(options?.storage === "sql" ? SqlShardStorage.layer : ShardStorage.layerNoop),
    Layer.provide([
      options?.serialization === "ndjson" ? RpcSerialization.layerNdjson : RpcSerialization.layerMsgPack,
      ShardingConfig.layerFromEnv(options?.shardingConfig)
    ])
  ) as any
