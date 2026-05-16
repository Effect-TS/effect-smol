/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

/**
 * Schema for branded string entity identifiers used inside the cluster.
 *
 * @category constructors
 * @since 4.0.0
 */
export const EntityId = Schema.String.pipe(Schema.brand("~effect/cluster/EntityId"))

/**
 * Branded string type representing the ID of an entity instance.
 *
 * @category models
 * @since 4.0.0
 */
export type EntityId = typeof EntityId.Type

/**
 * Brands a string as an `EntityId`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (id: string): EntityId => id as EntityId
