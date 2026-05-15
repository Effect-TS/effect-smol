/**
 * @since 1.0.0
 */
import * as Layer from "effect/Layer"
import * as Socket from "effect/unstable/socket/Socket"

/**
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
 * A WebSocket constructor that uses `globalThis.WebSocket`.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layerWebSocketConstructor: Layer.Layer<Socket.WebSocketConstructor> =
  Socket.layerWebSocketConstructorGlobal
