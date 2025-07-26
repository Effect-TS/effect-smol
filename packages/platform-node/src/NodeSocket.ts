/**
 * @since 1.0.0
 */
import { NodeWS as WS } from "@effect/platform-node-shared/NodeSocket"
import type * as Effect from "effect/Effect"
import { flow } from "effect/Function"
import * as Layer from "effect/Layer"
import type * as Duration from "effect/time/Duration"
import * as Socket from "effect/unstable/socket/Socket"

/**
 * @since 1.0.0
 */
export * from "@effect/platform-node-shared/NodeSocket"

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocketConstructor: Layer.Layer<
  Socket.WebSocketConstructor
> = Layer.sync(Socket.WebSocketConstructor)(() => {
  if ("WebSocket" in globalThis) {
    return (url, protocols) => new globalThis.WebSocket(url, protocols)
  }
  return (url, protocols) => new WS.WebSocket(url, protocols) as unknown as globalThis.WebSocket
})

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocket: (
  url: string | Effect.Effect<string>,
  options?: {
    readonly closeCodeIsError?: ((code: number) => boolean) | undefined
    readonly openTimeout?: Duration.DurationInput | undefined
    readonly protocols?: string | Array<string> | undefined
  } | undefined
) => Layer.Layer<Socket.Socket, never, never> = flow(
  Layer.effect(Socket.Socket)(Socket.makeWebSocket),
  Layer.provide(layerWebSocketConstructor)
)
