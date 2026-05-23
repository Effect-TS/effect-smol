/**
 * The `EntityId` module provides a branded string identifier for addressing a
 * specific entity instance inside the cluster. Entity ids are commonly used as
 * stable routing keys when sending messages to an entity, looking up its state,
 * or deriving the shard responsible for that entity.
 *
 * Because routing is based on the exact string value, choose ids that are
 * deterministic, normalized, and unique within the entity type you are
 * addressing. Avoid display names or other values that may change over time.
 *
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
 * **When to use**
 *
 * Use to turn a trusted, stable entity routing key into an `EntityId` before
 * passing it to cluster APIs.
 *
 * **Details**
 *
 * The branded value is the original string at runtime.
 *
 * **Gotchas**
 *
 * `make` does not validate, normalize, or make the value unique. Choose
 * deterministic strings because cluster routing hashes the exact entity id
 * value.
 *
 * @see {@link EntityId} for the schema that validates and encodes branded entity identifiers
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (id: string): EntityId => id as EntityId
