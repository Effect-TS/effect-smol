/**
 * @since 4.0.0
 */
import type * as Effect from "../../Effect.ts"
import type * as Exit from "../../Exit.ts"
import type * as PrimaryKey from "../../interfaces/PrimaryKey.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Serializer from "../../schema/Serializer.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const symbol = "~effect/persistence/Persistable" as const

/**
 * @since 4.0.0
 * @category Models
 */
export interface Persistable<A extends Schema.Top, E extends Schema.Top> extends PrimaryKey.PrimaryKey {
  readonly [symbol]: {
    readonly success: A
    readonly error: E
  }
}

/**
 * @since 4.0.0
 * @category Models
 */
export type Any = Persistable<Schema.Top, Schema.Top>

/**
 * @since 4.0.0
 * @category Accessors
 */
export const exitSchema = <A extends Schema.Top, E extends Schema.Top>(
  self: Persistable<A, E>
): Schema.Exit<A, E, Schema.Defect> => {
  let schema = exitSchemaCache.get(self)
  if (schema) return schema as Schema.Exit<A, E, Schema.Defect>
  schema = Schema.Exit(self[symbol].success, self[symbol].error, Schema.Defect)
  exitSchemaCache.set(self, schema)
  return schema as Schema.Exit<A, E, Schema.Defect>
}

const exitSchemaCache = new WeakMap<Persistable<any, any>, Schema.Exit<any, any, Schema.Defect>>()

/**
 * @since 4.0.0
 * @category Serialization
 */
export const serializeExit = <A extends Schema.Top, E extends Schema.Top>(
  self: Persistable<A, E>,
  exit: Exit.Exit<A["Type"], E["Type"]>
): Effect.Effect<unknown, Schema.SchemaError, A["EncodingServices"] | E["EncodingServices"]> => {
  const schema = Serializer.json(exitSchema(self))
  return Schema.encodeEffect(schema)(exit)
}

/**
 * @since 4.0.0
 * @category Serialization
 */
export const deserializeExit = <A extends Schema.Top, E extends Schema.Top>(
  self: Persistable<A, E>,
  encoded: unknown
): Effect.Effect<
  Exit.Exit<A["Type"], E["Type"]>,
  Schema.SchemaError,
  A["DecodingServices"] | E["DecodingServices"]
> => {
  const schema = Serializer.json(exitSchema(self))
  return Schema.decodeEffect(schema)(encoded)
}
