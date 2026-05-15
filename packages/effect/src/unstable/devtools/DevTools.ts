/**
 * @since 4.0.0
 */
import * as Layer from "../../Layer.ts"
import * as Socket from "../socket/Socket.ts"
import * as DevToolsClient from "./DevToolsClient.ts"

/**
 * @category layers
 * @since 4.0.0
 */
export const layerSocket: Layer.Layer<never, never, Socket.Socket> = DevToolsClient.layerTracer

/**
 * @category layers
 * @since 4.0.0
 */
export const layerWebSocket = (
  url = "ws://localhost:34437"
): Layer.Layer<never, never, Socket.WebSocketConstructor> =>
  DevToolsClient.layerTracer.pipe(
    Layer.provide(Socket.layerWebSocket(url))
  )

/**
 * @category layers
 * @since 4.0.0
 */
export const layer = (url = "ws://localhost:34437"): Layer.Layer<never> =>
  layerWebSocket(url).pipe(
    Layer.provide(Socket.layerWebSocketConstructorGlobal)
  )
