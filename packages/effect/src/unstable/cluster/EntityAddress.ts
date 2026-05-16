/**
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts"
import * as Hash from "../../Hash.ts"
import * as Schema from "../../Schema.ts"
import { EntityId } from "./EntityId.ts"
import { EntityType } from "./EntityType.ts"
import { ShardId } from "./ShardId.ts"

const TypeId = "~effect/cluster/EntityAddress"

/**
 * Represents the unique address of an entity within the cluster.
 *
 * @category models
 * @since 4.0.0
 */
export class EntityAddress extends Schema.Class<EntityAddress>(TypeId)({
  shardId: ShardId,
  entityType: EntityType,
  entityId: EntityId
}) {
  /**
   * Marks this value as a cluster entity address for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Formats the entity type, entity id, and shard id as a readable address.
   *
   * @since 4.0.0
   */
  override toString() {
    return `EntityAddress(${this.entityType.toString()}, ${this.entityId.toString()}, ${this.shardId.toString()})`
  }

  /**
   * Compares entity addresses by entity type, entity id, and shard id.
   *
   * @since 4.0.0
   */
  [Equal.symbol](that: EntityAddress): boolean {
    return this.entityType === that.entityType && this.entityId === that.entityId &&
      Equal.equals(this.shardId, that.shardId)
  }

  /**
   * Computes a structural hash from the entity type, entity id, and shard id.
   *
   * @since 4.0.0
   */
  [Hash.symbol]() {
    return Hash.string(`${this.entityType}:${this.entityId}:${this.shardId.toString()}`)
  }
}
/**
 * Constructs an `EntityAddress` from a shard ID, entity type, and entity ID.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (options: {
  readonly shardId: ShardId
  readonly entityType: EntityType
  readonly entityId: EntityId
}): EntityAddress => new EntityAddress(options, { disableChecks: true })
