/**
 * @since 4.0.0
 */
import * as Schema from "../../schema/Schema.ts"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/rpc/RpcClientError"

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = "~effect/rpc/RpcClientError"

/**
 * @since 4.0.0
 * @category Errors
 */
export class RpcClientError extends Schema.ErrorClass<RpcClientError>(TypeId)({
  _tag: Schema.tag("RpcClientError"),
  reason: Schema.Literals(["Protocol", "Unknown"]),
  message: Schema.String,
  // TODO: Use Schema.Defect when available
  cause: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
}
