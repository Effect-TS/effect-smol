/**
 * @since 4.0.0
 */
import * as Equal from "../../interfaces/Equal.ts"
import * as Hash from "../../interfaces/Hash.ts"
import * as Schema from "../../schema/Schema.ts"
import { EntityId } from "./EntityId.ts"
import { EntityType } from "./EntityType.ts"
import { ShardId } from "./ShardId.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/cluster/EntityAddress"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/cluster/EntityAddress"

/**
 * Represents the unique address of an entity within the cluster.
 *
 * @since 4.0.0
 * @category models
 */
export class EntityAddress extends Schema.Class<EntityAddress>(TypeId)({
  shardId: ShardId,
  entityType: EntityType,
  entityId: EntityId
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId;

  /**
   * @since 4.0.0
   */
  [Equal.symbol](that: EntityAddress): boolean {
    return this.entityType === that.entityType && this.entityId === that.entityId &&
      this.shardId[Equal.symbol](that.shardId)
  }

  /**
   * @since 4.0.0
   */
  [Hash.symbol]() {
    return Hash.cached(this, () => Hash.string(`${this.entityType}:${this.entityId}:${this.shardId.toString()}`))
  }
}
/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (options: {
  readonly shardId: ShardId
  readonly entityType: EntityType
  readonly entityId: EntityId
}): EntityAddress => new EntityAddress(options, { disableValidation: true })
