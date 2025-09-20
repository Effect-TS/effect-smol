/**
 * @since 1.0.0
 */
import { layerClientProtocol, layerSocketServer } from "@effect/platform-node-shared/NodeClusterRunnerSocket"
import type * as Config from "effect/config/Config"
import * as Layer from "effect/Layer"
import * as MessageStorage from "effect/unstable/cluster/MessageStorage"
import * as RunnerHealth from "effect/unstable/cluster/RunnerHealth"
import * as Runners from "effect/unstable/cluster/Runners"
import * as RunnerStorage from "effect/unstable/cluster/RunnerStorage"
import type { Sharding } from "effect/unstable/cluster/Sharding"
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig"
import * as SocketRunner from "effect/unstable/cluster/SocketRunner"
import * as SqlMessageStorage from "effect/unstable/cluster/SqlMessageStorage"
import * as SqlRunnerStorage from "effect/unstable/cluster/SqlRunnerStorage"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import type * as SocketServer from "effect/unstable/socket/SocketServer"
import type { SqlClient } from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"

export {
  /**
   * @since 1.0.0
   * @category Re-exports
   */
  layerClientProtocol,
  /**
   * @since 1.0.0
   * @category Re-exports
   */
  layerSocketServer
}

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = <
  const ClientOnly extends boolean = false,
  const Storage extends "local" | "sql" = never
>(
  options?: {
    readonly serialization?: "msgpack" | "ndjson" | undefined
    readonly clientOnly?: ClientOnly | undefined
    readonly storage?: Storage | undefined
    readonly shardingConfig?: Partial<ShardingConfig.ShardingConfig["Service"]> | undefined
  }
): ClientOnly extends true ? Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    Config.ConfigError,
    "local" extends Storage ? SqlClient : never
  > :
  Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    SocketServer.SocketServerError | Config.ConfigError | ("sql" extends Storage ? SqlError : never),
    ("local" extends Storage ? SqlClient : never)
  > =>
{
  const layer: Layer.Layer<any, any, any> = options?.clientOnly
    // client only
    ? Layer.provide(SocketRunner.layerClientOnly, layerClientProtocol)
    // with server
    : Layer.provide(SocketRunner.layer, [layerSocketServer, layerClientProtocol])

  const runnerHealth: Layer.Layer<any, any, any> = options?.clientOnly
    ? Layer.empty as any
    // TODO: when bun supports adding custom CA certificates
    // : options?.runnerHealth === "k8s"
    // ? RunnerHealth.layerK8s().pipe(
    //   Layer.provide([NodeFileSystem.layer, layerHttpClientK8s])
    // )
    : RunnerHealth.layerPing.pipe(
      Layer.provide(Runners.layerRpc),
      Layer.provide(layerClientProtocol)
    )

  return layer.pipe(
    Layer.provide(runnerHealth),
    Layer.provideMerge(
      options?.storage === "local"
        ? MessageStorage.layerNoop
        : SqlMessageStorage.layer
    ),
    Layer.provide(options?.storage === "local" ? RunnerStorage.layerMemory : SqlRunnerStorage.layer),
    Layer.provide(ShardingConfig.layerFromEnv(options?.shardingConfig)),
    Layer.provide(
      options?.serialization === "ndjson" ? RpcSerialization.layerNdjson : RpcSerialization.layerMsgPack
    )
  ) as any
}
