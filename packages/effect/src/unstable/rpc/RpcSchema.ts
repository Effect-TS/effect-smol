/**
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import * as Annotations from "../../schema/Annotations.ts"
import type * as AST from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Stream_ from "../../stream/Stream.ts"

/**
 * @since 4.0.0
 * @category Stream
 */
export const StreamSchemaTypeId = "~effect/rpc/RpcSchema/StreamSchema"

/**
 * @since 4.0.0
 * @category Stream
 */
export function isStreamSchema(schema: Schema.Top): schema is Stream<any, any> {
  return getStreamSchemas(schema.ast) !== undefined
}

/**
 * @since 4.0.0
 * @category Stream
 */
export const getStreamSchemas = Annotations.getAt(StreamSchemaTypeId, (u: unknown): u is {
  readonly success: Schema.Top
  readonly error: Schema.Top
} => Predicate.isObject(u))

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
    Annotations.Annotations
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
  const schema = Schema.declare(Stream_.isStream, { [StreamSchemaTypeId]: options })
  return Object.assign(
    schema,
    options
  ) as any as Stream<A, E>
}
