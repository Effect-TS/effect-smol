/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

/**
 * @category constructors
 * @since 4.0.0
 */
export const EntityId = Schema.String.pipe(Schema.brand("~effect/cluster/EntityId"))

/**
 * @category models
 * @since 4.0.0
 */
export type EntityId = typeof EntityId.Type

/**
 * @category constructors
 * @since 4.0.0
 */
export const make = (id: string): EntityId => id as EntityId
