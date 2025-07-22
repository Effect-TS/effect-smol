/**
 * @since 1.0.0
 */
import type { Effect } from "effect/Effect"
import { flow } from "effect/Function"
import * as Layer from "effect/services/Layer"
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
> = Layer.succeed(Socket.WebSocketConstructor)(
  (url, protocols) => new globalThis.WebSocket(url, protocols)
)

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocket: (
  url: string | Effect<string>,
  options?: {
    readonly closeCodeIsError?: ((code: number) => boolean) | undefined
    readonly openTimeout?: Duration.DurationInput | undefined
    readonly protocols?: string | Array<string> | undefined
  } | undefined
) => Layer.Layer<Socket.Socket, never, never> = flow(
  Layer.effect(Socket.Socket)(Socket.makeWebSocket),
  Layer.provide(layerWebSocketConstructor)
)
