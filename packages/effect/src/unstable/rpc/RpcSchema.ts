/**
 * @since 4.0.0
 */
import * as Option from "../../data/Option.ts"
import type { Annotations } from "../../schema/Annotations.ts"
import type * as AST from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.js"
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
export const getStreamSchemas = (
  ast: AST.AST
): Option.Option<{
  readonly success: Schema.Top
  readonly error: Schema.Top
}> => ast.annotations?.[StreamSchemaId] ? Option.some(ast.annotations[StreamSchemaId] as any) : Option.none()

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
