/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

const TypeId = "~effect/rpc/RpcClientError"

/**
 * @since 4.0.0
 * @category Errors
 */
export class RpcClientError extends Schema.ErrorClass<RpcClientError>(TypeId)({
  _tag: Schema.tag("RpcClientError"),
  reason: Schema.Literals(["Protocol", "Unknown"]),
  message: Schema.String,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
}
