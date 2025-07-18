/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"
import type * as Effect from "../../Effect.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Socket from "./Socket.ts"

/**
 * @since 4.0.0
 * @category tags
 */
export class SocketServer extends ServiceMap.Key<
  SocketServer,
  {
    readonly address: Address
    readonly run: <R, E, _>(
      handler: (socket: Socket.Socket) => Effect.Effect<_, E, R>
    ) => Effect.Effect<never, SocketServerError, R>
  }
>()("@effect/platform/SocketServer") {}

/**
 * @since 4.0.0
 * @category errors
 */
export const ErrorTypeId: ErrorTypeId = "@effect/platform/SocketServer/SocketServerError"

/**
 * @since 4.0.0
 * @category errors
 */
export type ErrorTypeId = "@effect/platform/SocketServer/SocketServerError"

/**
 * @since 4.0.0
 * @category errors
 */
export class SocketServerError extends Data.TaggedError("SocketServerError")<{
  readonly reason: "Open" | "Unknown"
  readonly cause: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: ErrorTypeId = ErrorTypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    return this.reason
  }
}

/**
 * @since 4.0.0
 * @category models
 */
export type Address = UnixAddress | TcpAddress

/**
 * @since 4.0.0
 * @category models
 */
export interface TcpAddress {
  readonly _tag: "TcpAddress"
  readonly hostname: string
  readonly port: number
}

/**
 * @since 4.0.0
 * @category models
 */
export interface UnixAddress {
  readonly _tag: "UnixAddress"
  readonly path: string
}
