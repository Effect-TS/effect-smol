/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

/**
 * Schema for branded string names that identify entity types in the cluster.
 *
 * @category constructors
 * @since 4.0.0
 */
export const EntityType = Schema.String.pipe(Schema.brand("~effect/cluster/EntityType"))

/**
 * Branded string type representing an entity type name.
 *
 * @category models
 * @since 4.0.0
 */
export type EntityType = typeof EntityType.Type

/**
 * Brands a string as an `EntityType`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (value: string): EntityType => value as EntityType
