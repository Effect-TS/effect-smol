/**
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts"
import * as Hash from "../../Hash.ts"
import * as Schema from "../../schema/Schema.ts"
import { ShardId } from "./ShardId.ts"

/**
 * @since 4.0.0
 * @category Address
 */
export const TypeId: unique symbol = Symbol.for("@effect/cluster/SingletonAddress")

/**
 * @since 4.0.0
 * @category Address
 */
export type TypeId = typeof TypeId

/**
 * Represents the unique address of an singleton within the cluster.
 *
 * @since 4.0.0
 * @category Address
 */
export class SingletonAddress extends Schema.Class<SingletonAddress>("@effect/cluster/SingletonAddress")({
  shardId: ShardId,
  name: Schema.NonEmptyTrimmedString
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId;
  /**
   * @since 4.0.0
   */
  [Hash.symbol]() {
    return Hash.cached(this)(Hash.string(`${this.name}:${this.shardId.toString()}`))
  }
  /**
   * @since 4.0.0
   */
  [Equal.symbol](that: SingletonAddress): boolean {
    return this.name === that.name && this.shardId[Equal.symbol](that.shardId)
  }
}
