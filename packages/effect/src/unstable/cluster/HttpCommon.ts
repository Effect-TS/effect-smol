/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as HttpClient from "../http/HttpClient.ts"
import * as HttpClientRequest from "../http/HttpClientRequest.ts"
import * as RpcClient from "../rpc/RpcClient.ts"
import * as RpcSerialization from "../rpc/RpcSerialization.ts"
import * as Socket from "../socket/Socket.ts"
import { RpcClientProtocol } from "./Runners.ts"

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerClientProtocolHttp = (options: {
  readonly path: string
  readonly https?: boolean | undefined
}): Layer.Layer<
  RpcClientProtocol,
  never,
  RpcSerialization.RpcSerialization | HttpClient.HttpClient
> =>
  Layer.effect(RpcClientProtocol)(
    Effect.gen(function*() {
      const serialization = yield* RpcSerialization.RpcSerialization
      const client = yield* HttpClient.HttpClient
      const https = options.https ?? false
      return (address) => {
        const clientWithUrl = HttpClient.mapRequest(
          client,
          HttpClientRequest.prependUrl(`http${https ? "s" : ""}://${address.host}:${address.port}/${options.path}`)
        )
        return RpcClient.makeProtocolHttp(clientWithUrl).pipe(
          Effect.provideService(RpcSerialization.RpcSerialization, serialization)
        )
      }
    })
  )

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerClientProtocolWebsocket = (options: {
  readonly path: string
  readonly https?: boolean | undefined
}): Layer.Layer<
  RpcClientProtocol,
  never,
  RpcSerialization.RpcSerialization | Socket.WebSocketConstructor
> =>
  Layer.effect(RpcClientProtocol)(
    Effect.gen(function*() {
      const serialization = yield* RpcSerialization.RpcSerialization
      const https = options.https ?? false
      const constructor = yield* Socket.WebSocketConstructor
      return Effect.fnUntraced(function*(address) {
        const socket = yield* Socket.makeWebSocket(
          `ws${https ? "s" : ""}://${address.host}:${address.port}/${options.path}`
        ).pipe(
          Effect.provideService(Socket.WebSocketConstructor, constructor)
        )
        return yield* RpcClient.makeProtocolSocket().pipe(
          Effect.provideService(Socket.Socket, socket),
          Effect.provideService(RpcSerialization.RpcSerialization, serialization)
        )
      })
    })
  )
