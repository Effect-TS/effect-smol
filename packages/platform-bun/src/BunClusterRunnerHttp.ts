/**
 * @since 1.0.0
 */
import type * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpRunner from "effect/unstable/cluster/HttpRunner"
import * as MessageStorage from "effect/unstable/cluster/MessageStorage"
import type * as Runners from "effect/unstable/cluster/Runners"
import type * as RunnerStorage from "effect/unstable/cluster/RunnerStorage"
import type { Sharding } from "effect/unstable/cluster/Sharding"
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig"
import * as SqlMessageStorage from "effect/unstable/cluster/SqlMessageStorage"
import * as SqlRunnerStorage from "effect/unstable/cluster/SqlRunnerStorage"
import type * as Etag from "effect/unstable/http/Etag"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type { HttpPlatform } from "effect/unstable/http/HttpPlatform"
import type { HttpServer } from "effect/unstable/http/HttpServer"
import type { ServeError } from "effect/unstable/http/HttpServerError"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import type { SqlClient } from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import * as BunHttpServer from "./BunHttpServer.ts"
import type { BunServices } from "./BunServices.ts"
import * as BunSocket from "./BunSocket.ts"

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerHttpServer: Layer.Layer<
  | HttpPlatform
  | Etag.Generator
  | BunServices
  | HttpServer,
  ServeError,
  ShardingConfig.ShardingConfig
> = Effect.gen(function*() {
  const config = yield* ShardingConfig.ShardingConfig
  const listenAddress = config.runnerListenAddress ?? config.runnerAddress
  if (listenAddress === undefined) {
    return yield* Effect.die("BunClusterHttpRunners.layerHttpServer: ShardingConfig.runnerAddress is None")
  }
  return BunHttpServer.layer(listenAddress)
}).pipe(Layer.unwrap)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = <
  const ClientOnly extends boolean = false,
  const Storage extends "noop" | "sql" = never
>(options: {
  readonly transport: "http" | "websocket"
  readonly serialization?: "msgpack" | "ndjson" | undefined
  readonly clientOnly?: ClientOnly | undefined
  readonly storage?: Storage | undefined
  readonly shardingConfig?: Partial<ShardingConfig.ShardingConfig["Service"]> | undefined
}): ClientOnly extends true ? Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    Config.ConfigError | ("sql" extends Storage ? SqlError : never),
    "sql" extends Storage ? SqlClient : RunnerStorage.RunnerStorage
  > :
  Layer.Layer<
    Sharding | Runners.Runners | MessageStorage.MessageStorage,
    ServeError | Config.ConfigError | ("sql" extends Storage ? SqlError : never),
    "sql" extends Storage ? SqlClient : RunnerStorage.RunnerStorage
  > =>
{
  const layer: Layer.Layer<any, any, any> = options.clientOnly
    // client only
    ? options.transport === "http"
      ? Layer.provide(HttpRunner.layerHttpClientOnly, FetchHttpClient.layer)
      : Layer.provide(HttpRunner.layerWebsocketClientOnly, BunSocket.layerWebSocketConstructor)
    // with server
    : options.transport === "http"
    ? Layer.provide(HttpRunner.layerHttp, [layerHttpServer, FetchHttpClient.layer])
    : Layer.provide(HttpRunner.layerWebsocket, [layerHttpServer, BunSocket.layerWebSocketConstructor])

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
