/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import * as Data from "../../Data.ts"
import type * as Effect from "../../Effect.ts"
import type * as Socket from "./Socket.ts"

/**
 * @category tags
 * @since 4.0.0
 */
export class SocketServer extends Context.Service<SocketServer, {
  readonly address: Address
  readonly run: <R, E, _>(
    handler: (socket: Socket.Socket) => Effect.Effect<_, E, R>
  ) => Effect.Effect<never, SocketServerError, R>
}>()("@effect/platform/SocketServer") {}

/**
 * @category errors
 * @since 4.0.0
 */
export const ErrorTypeId: ErrorTypeId = "@effect/platform/SocketServer/SocketServerError"

/**
 * @category errors
 * @since 4.0.0
 */
export type ErrorTypeId = "@effect/platform/SocketServer/SocketServerError"

/**
 * @category errors
 * @since 4.0.0
 */
export class SocketServerOpenError extends Data.TaggedError("SocketServerOpenError")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return "Open"
  }
}

/**
 * @category errors
 * @since 4.0.0
 */
export class SocketServerUnknownError extends Data.TaggedError("SocketServerUnknownError")<{
  readonly cause: unknown
}> {
  override get message(): string {
    return "Unknown"
  }
}

/**
 * @category errors
 * @since 4.0.0
 */
export type SocketServerErrorReason = SocketServerOpenError | SocketServerUnknownError

/**
 * @category errors
 * @since 4.0.0
 */
export class SocketServerError extends Data.TaggedError("SocketServerError")<{
  readonly reason: SocketServerErrorReason
}> {
  constructor(props: {
    readonly reason: SocketServerErrorReason
  }) {
    super({
      ...props,
      cause: props.reason.cause
    } as any)
  }
  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: ErrorTypeId = ErrorTypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    return this.reason.message
  }
}

/**
 * @category models
 * @since 4.0.0
 */
export type Address = UnixAddress | TcpAddress

/**
 * @category models
 * @since 4.0.0
 */
export interface TcpAddress {
  readonly _tag: "TcpAddress"
  readonly hostname: string
  readonly port: number
}

/**
 * @category models
 * @since 4.0.0
 */
export interface UnixAddress {
  readonly _tag: "UnixAddress"
  readonly path: string
}
