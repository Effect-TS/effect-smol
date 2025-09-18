/**
 * @since 1.0.0
 */
import type * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpRunner from "effect/unstable/cluster/HttpRunner"
import * as MessageStorage from "effect/unstable/cluster/MessageStorage"
import * as RunnerHealth from "effect/unstable/cluster/RunnerHealth"
import type * as Runners from "effect/unstable/cluster/Runners"
import * as RunnerStorage from "effect/unstable/cluster/RunnerStorage"
import type { Sharding } from "effect/unstable/cluster/Sharding"
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig"
import * as SqlMessageStorage from "effect/unstable/cluster/SqlMessageStorage"
import * as SqlRunnerStorage from "effect/unstable/cluster/SqlRunnerStorage"
import type * as Etag from "effect/unstable/http/Etag"
import type { HttpPlatform } from "effect/unstable/http/HttpPlatform"
import type { HttpServer } from "effect/unstable/http/HttpServer"
import type { ServeError } from "effect/unstable/http/HttpServerError"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import type { SqlClient } from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import { createServer } from "node:http"
import { layerHttpClientK8s } from "./NodeClusterRunnerSocket.ts"
import * as NodeFileSystem from "./NodeFileSystem.ts"
import * as NodeHttpClient from "./NodeHttpClient.ts"
import * as NodeHttpServer from "./NodeHttpServer.ts"
import type { NodeServices } from "./NodeServices.ts"
import * as NodeSocket from "./NodeSocket.ts"

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = <
  const ClientOnly extends boolean = false,
  const Storage extends "local" | "sql" = never,
  const Health extends "ping" | "k8s" = never
>(options: {
  readonly transport: "http" | "websocket"
  readonly serialization?: "msgpack" | "ndjson" | undefined
  readonly clientOnly?: ClientOnly | undefined
  readonly storage?: Storage | undefined
  readonly runnerHealth?: Health | undefined
  readonly runnerHealthK8s?: {
    readonly namespace?: string | undefined
    readonly labelSelector?: string | undefined
  } | undefined
  readonly shardingConfig?: Partial<ShardingConfig.ShardingConfig["Service"]> | undefined
}): ClientOnly extends true ? Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    Config.ConfigError | ("local" extends Storage ? never : SqlError),
    "local" extends Storage ? never : SqlClient
  > :
  Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    ServeError | Config.ConfigError | ("local" extends Storage ? never : SqlError),
    "local" extends Storage ? never : SqlClient
  > =>
{
  const layer: Layer.Layer<any, any, any> = options.clientOnly
    // client only
    ? options.transport === "http"
      ? Layer.provide(HttpRunner.layerHttpClientOnly, NodeHttpClient.layerUndici)
      : Layer.provide(HttpRunner.layerWebsocketClientOnly, NodeSocket.layerWebSocketConstructor)
    // with server
    : options.transport === "http"
    ? Layer.provide(HttpRunner.layerHttp, [layerHttpServer, NodeHttpClient.layerUndici])
    : Layer.provide(HttpRunner.layerWebsocket, [layerHttpServer, NodeSocket.layerWebSocketConstructor])

  const runnerHealth: Layer.Layer<any, any, any> = options?.clientOnly
    ? Layer.empty as any
    : options?.runnerHealth === "k8s"
    ? RunnerHealth.layerK8s(options.runnerHealthK8s).pipe(
      Layer.provide([NodeFileSystem.layer, layerHttpClientK8s])
    )
    : RunnerHealth.layerPing.pipe(
      Layer.provide(layer)
    )

  return layer.pipe(
    Layer.provideMerge(
      options?.storage === "local"
        ? MessageStorage.layerNoop
        : SqlMessageStorage.layer
    ),
    Layer.provide(options?.storage === "local" ? RunnerStorage.layerMemory : SqlRunnerStorage.layer),
    Layer.provide(runnerHealth),
    Layer.provide(ShardingConfig.layerFromEnv(options?.shardingConfig)),
    Layer.provide(
      options?.serialization === "ndjson" ? RpcSerialization.layerNdjson : RpcSerialization.layerMsgPack
    )
  ) as any
}

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerHttpServer: Layer.Layer<
  | HttpPlatform
  | Etag.Generator
  | NodeServices
  | HttpServer,
  ServeError,
  ShardingConfig.ShardingConfig
> = Effect.gen(function*() {
  const config = yield* ShardingConfig.ShardingConfig
  const listenAddress = config.runnerListenAddress ?? config.runnerAddress
  if (listenAddress === undefined) {
    return yield* Effect.die("NodeClusterHttpRunner.layerHttpServer: ShardingConfig.podAddress is None")
  }
  return NodeHttpServer.layer(createServer, listenAddress)
}).pipe(Layer.unwrap)
