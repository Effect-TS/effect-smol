/**
 * @since 4.0.0
 */
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import type * as AST from "../../SchemaAST.ts"
import * as Stream_ from "../../Stream.ts"

const StreamSchemaTypeId = "~effect/rpc/RpcSchema/StreamSchema"

/**
 * @since 4.0.0
 * @category Stream
 */
export function isStreamSchema(schema: Schema.Top): schema is Stream<Schema.Top, Schema.Top> {
  return Predicate.hasProperty(schema, StreamSchemaTypeId)
}

/** @internal */
export function getStreamSchemas(schema: Schema.Top): {
  readonly success: Schema.Top
  readonly error: Schema.Top
} | undefined {
  return isStreamSchema(schema) ?
    {
      success: schema.success,
      error: schema.error
    } :
    undefined
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
    AST.Declaration,
    Stream<A, E>
  >
{
  readonly "~rebuild.out": this
  readonly [StreamSchemaTypeId]: typeof StreamSchemaTypeId
  readonly success: A
  readonly error: E
}

const schema = Schema.declare(Stream_.isStream)

/**
 * @since 4.0.0
 * @category Stream
 */
export function Stream<A extends Schema.Top, E extends Schema.Top>(success: A, error: E): Stream<A, E> {
  return Schema.make(schema.ast, { [StreamSchemaTypeId]: StreamSchemaTypeId, success, error })
}
