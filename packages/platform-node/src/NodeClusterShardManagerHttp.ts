/**
 * @since 1.0.0
 */
import type * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpShardManager from "effect/unstable/cluster/HttpShardManager"
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig"
import * as ShardManager from "effect/unstable/cluster/ShardManager"
import * as ShardStorage from "effect/unstable/cluster/ShardStorage"
import * as SqlShardStorage from "effect/unstable/cluster/SqlShardStorage"
import type * as Etag from "effect/unstable/http/Etag"
import type { HttpPlatform } from "effect/unstable/http/HttpPlatform"
import type { HttpServer } from "effect/unstable/http/HttpServer"
import type { ServeError } from "effect/unstable/http/HttpServerError"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import type { SqlClient } from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import { createServer } from "node:http"
import * as NodeHttpClient from "./NodeHttpClient.ts"
import * as NodeHttpServer from "./NodeHttpServer.ts"
import type { NodeServices } from "./NodeServices.ts"
import * as NodeSocket from "./NodeSocket.ts"

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
  return NodeHttpServer.layer(createServer, config.shardManagerAddress)
}).pipe(Layer.unwrap)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = <const Storage extends "sql" | "noop" = never>(options: {
  readonly transport: "http" | "websocket"
  readonly serialization?: "msgpack" | "ndjson" | undefined
  readonly shardingConfig?: Partial<ShardingConfig.ShardingConfig["Service"]> | undefined
  readonly storage?: Storage | undefined
  readonly config?: Partial<ShardManager.Config["Service"]> | undefined
}): Layer.Layer<
  ShardManager.ShardManager,
  ServeError | Config.ConfigError | ("sql" extends Storage ? SqlError : never),
  "sql" extends Storage ? SqlClient : never
> => {
  const layer: Layer.Layer<any, any, any> = options.transport === "http" ?
    HttpShardManager.layerHttp.pipe(
      Layer.provide([HttpShardManager.layerRunnerHealthHttp, layerHttpServer]),
      Layer.provide(NodeHttpClient.layerUndici)
    ) :
    HttpShardManager.layerWebsocket.pipe(
      Layer.provide([HttpShardManager.layerRunnerHealthWebsocket, layerHttpServer]),
      Layer.provide(NodeSocket.layerWebSocketConstructor)
    )
  return layer.pipe(
    Layer.provide(options?.storage === "sql" ? SqlShardStorage.layer : ShardStorage.layerNoop),
    Layer.provide([
      ShardingConfig.layerFromEnv(options.shardingConfig),
      ShardManager.layerConfigFromEnv(options?.config),
      options?.serialization === "ndjson" ? RpcSerialization.layerNdjson : RpcSerialization.layerMsgPack
    ])
  )
}
