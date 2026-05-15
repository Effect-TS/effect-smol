/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"
import type { Entity } from "./Entity.ts"
import type { SingletonAddress } from "./SingletonAddress.ts"

/**
 * Represents events that can occur when a runner registers entities or singletons.
 *
 * @category models
 * @since 4.0.0
 */
export type ShardingRegistrationEvent =
  | EntityRegistered
  | SingletonRegistered

/**
 * Represents an event that occurs when a new entity is registered with a runner.
 *
 * @category models
 * @since 4.0.0
 */
export interface EntityRegistered {
  readonly _tag: "EntityRegistered"
  readonly entity: Entity<any, any>
}

/**
 * Represents an event that occurs when a new singleton is registered with a
 * runner.
 *
 * @category models
 * @since 4.0.0
 */
export interface SingletonRegistered {
  readonly _tag: "SingletonRegistered"
  readonly address: SingletonAddress
}

/**
 * @category pattern matching
 * @since 4.0.0
 */
export const {
  /**
   * @category pattern matching
   * @since 4.0.0
   */
  $match: match,
  /**
   * @category constructors
   * @since 4.0.0
   */
  EntityRegistered,
  /**
   * @category constructors
   * @since 4.0.0
   */
  SingletonRegistered
} = Data.taggedEnum<ShardingRegistrationEvent>()
