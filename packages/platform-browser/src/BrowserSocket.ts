/**
 * @since 1.0.0
 */
import * as Layer from "effect/Layer"
import * as Socket from "effect/unstable/socket/Socket"

/**
 * Creates a `Socket` layer connected to the given URL using the browser `WebSocket` constructor.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layerWebSocket = (url: string, options?: {
  readonly closeCodeIsError?: (code: number) => boolean
}): Layer.Layer<Socket.Socket> =>
  Layer.effect(Socket.Socket, Socket.makeWebSocket(url, options)).pipe(
    Layer.provide(layerWebSocketConstructor)
  )

/**
 * Layer that provides a `WebSocketConstructor` service backed by `globalThis.WebSocket`.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layerWebSocketConstructor: Layer.Layer<Socket.WebSocketConstructor> =
  Socket.layerWebSocketConstructorGlobal
