/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"
import { HttpClientErrorSchema } from "../http/HttpClientError.ts"
import { SocketErrorReason } from "../socket/Socket.ts"
import { WorkerErrorReason } from "../workers/WorkerError.ts"

const TypeId = "~effect/rpc/RpcClientError"

/**
 * @category Errors
 * @since 4.0.0
 */
export class RpcClientDefect extends Schema.ErrorClass<RpcClientDefect>("effect/rpc/RpcClientError/RpcClientDefect")({
  _tag: Schema.tag("RpcClientDefect"),
  message: Schema.String,
  cause: Schema.Defect
}) {}

/**
 * @category Errors
 * @since 4.0.0
 */
export class RpcClientError extends Schema.ErrorClass<RpcClientError>(TypeId)({
  _tag: Schema.tag("RpcClientError"),
  reason: Schema.Union([
    WorkerErrorReason,
    SocketErrorReason,
    HttpClientErrorSchema,
    RpcClientDefect
  ])
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  override get message(): string {
    return `${this.reason._tag}: ${this.reason.message}`
  }
}
