/**
 * @since 4.0.0
 */
import type { Annotations } from "../../schema/Annotations.ts"
import type * as AST from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Stream_ from "../../stream/Stream.ts"

/**
 * @since 4.0.0
 * @category Stream
 */
export const StreamSchemaId: "~effect/rpc/RpcSchema/Stream" = "~effect/rpc/RpcSchema/Stream" as const

/**
 * @since 4.0.0
 * @category Stream
 */
export const isStreamSchema = (schema: Schema.Top): schema is Stream<any, any> =>
  schema.ast.annotations !== undefined && StreamSchemaId in schema.ast.annotations

/**
 * @since 4.0.0
 * @category Stream
 */
export function getStreamSchemas(
  ast: AST.AST
): {
  readonly success: Schema.Top
  readonly error: Schema.Top
} | undefined {
  return ast.annotations?.[StreamSchemaId] as any
}

/**
 * @since 4.0.0
 * @category Stream
 */
export interface Stream<A extends Schema.Top, E extends Schema.Top> extends
  Schema.Bottom<
    Stream_.Stream<A["Type"], E["Type"]>,
    Stream_.Stream<A["Encoded"], E["Encoded"]>,
    A["DecodingServices"] | E["DecodingServices"],
    A["EncodingServices"] | E["EncodingServices"],
    AST.AST,
    Stream<A, E>,
    Annotations
  >
{
  readonly success: A
  readonly error: E
}

/**
 * @since 4.0.0
 * @category Stream
 */
export const Stream = <A extends Schema.Top, E extends Schema.Top>(
  options: {
    readonly error: E
    readonly success: A
  }
): Stream<A, E> => {
  const schema = Schema.declare(Stream_.isStream)
  return Object.assign(
    schema.annotate({ [StreamSchemaId]: options }),
    options
  ) as any as Stream<A, E>
}
