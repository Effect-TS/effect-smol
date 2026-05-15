/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

/**
 * @category constructors
 * @since 4.0.0
 */
export const EntityType = Schema.String.pipe(Schema.brand("~effect/cluster/EntityType"))

/**
 * @category models
 * @since 4.0.0
 */
export type EntityType = typeof EntityType.Type

/**
 * @category constructors
 * @since 4.0.0
 */
export const make = (value: string): EntityType => value as EntityType
