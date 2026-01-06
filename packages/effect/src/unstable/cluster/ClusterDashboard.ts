/**
 * @since 4.0.0
 */
import type * as Effect from "../../Effect.ts"
import * as Schema from "../../Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Stream from "../../Stream.ts"
import { ShardId } from "./ShardId.ts"

// -----------------------------------------------------------------------------
// Schema Types
// -----------------------------------------------------------------------------

const EntityInstanceInfoTypeId = "~effect/cluster/EntityInstanceInfo"

/**
 * Information about an active entity instance.
 *
 * @since 4.0.0
 * @category models
 */
export class EntityInstanceInfo extends Schema.Class<EntityInstanceInfo>(EntityInstanceInfoTypeId)({
  entityId: Schema.String,
  entityType: Schema.String,
  shardId: ShardId,
  runnerHost: Schema.String,
  runnerPort: Schema.Number,
  activeRequestCount: Schema.Number,
  mailboxSize: Schema.Number,
  lastActiveAt: Schema.Number,
  keepAliveEnabled: Schema.Boolean
}) {
  /**
   * @since 4.0.0
   */
  readonly [EntityInstanceInfoTypeId] = EntityInstanceInfoTypeId
}

const EntityTypeInfoTypeId = "~effect/cluster/EntityTypeInfo"

/**
 * Information about a registered entity type.
 *
 * @since 4.0.0
 * @category models
 */
export class EntityTypeInfo extends Schema.Class<EntityTypeInfo>(EntityTypeInfoTypeId)({
  entityType: Schema.String,
  activeInstanceCount: Schema.Number,
  registeredAt: Schema.Number
}) {
  /**
   * @since 4.0.0
   */
  readonly [EntityTypeInfoTypeId] = EntityTypeInfoTypeId
}

/**
 * Status of a shard.
 *
 * @since 4.0.0
 * @category models
 */
export const ShardStatus = Schema.Literals(["assigned", "acquiring", "releasing", "unassigned"])

/**
 * @since 4.0.0
 * @category models
 */
export type ShardStatus = typeof ShardStatus.Type

const ShardInfoTypeId = "~effect/cluster/ShardInfo"

/**
 * Information about a shard.
 *
 * @since 4.0.0
 * @category models
 */
export class ShardInfo extends Schema.Class<ShardInfo>(ShardInfoTypeId)({
  shardId: ShardId,
  runnerHost: Schema.String,
  runnerPort: Schema.Number,
  status: ShardStatus,
  entityCount: Schema.Number
}) {
  /**
   * @since 4.0.0
   */
  readonly [ShardInfoTypeId] = ShardInfoTypeId
}

const RunnerInfoTypeId = "~effect/cluster/RunnerInfo"

/**
 * Information about a runner.
 *
 * @since 4.0.0
 * @category models
 */
export class RunnerInfo extends Schema.Class<RunnerInfo>(RunnerInfoTypeId)({
  host: Schema.String,
  port: Schema.Number,
  groups: Schema.Array(Schema.String),
  weight: Schema.Number,
  healthy: Schema.Boolean,
  shardCount: Schema.Number,
  entityCount: Schema.Number
}) {
  /**
   * @since 4.0.0
   */
  readonly [RunnerInfoTypeId] = RunnerInfoTypeId
}

const SingletonInfoTypeId = "~effect/cluster/SingletonInfo"

/**
 * Information about a singleton.
 *
 * @since 4.0.0
 * @category models
 */
export class SingletonInfo extends Schema.Class<SingletonInfo>(SingletonInfoTypeId)({
  name: Schema.String,
  shardId: ShardId,
  running: Schema.Boolean,
  runnerHost: Schema.optional(Schema.String),
  runnerPort: Schema.optional(Schema.Number)
}) {
  /**
   * @since 4.0.0
   */
  readonly [SingletonInfoTypeId] = SingletonInfoTypeId
}

const RunnerSnapshotTypeId = "~effect/cluster/RunnerSnapshot"

/**
 * Snapshot of a runner's state for dashboard purposes.
 *
 * @since 4.0.0
 * @category models
 */
export class RunnerSnapshot extends Schema.Class<RunnerSnapshot>(RunnerSnapshotTypeId)({
  host: Schema.String,
  port: Schema.Number,
  groups: Schema.Array(Schema.String),
  weight: Schema.Number,
  healthy: Schema.Boolean,
  isShutdown: Schema.Boolean,
  registeredEntityTypes: Schema.Array(EntityTypeInfo),
  entityInstances: Schema.Array(EntityInstanceInfo),
  shards: Schema.Array(ShardInfo),
  singletons: Schema.Array(SingletonInfo)
}) {
  /**
   * @since 4.0.0
   */
  readonly [RunnerSnapshotTypeId] = RunnerSnapshotTypeId
}

const ClusterSnapshotTypeId = "~effect/cluster/ClusterSnapshot"

/**
 * Aggregated snapshot of cluster state.
 *
 * @since 4.0.0
 * @category models
 */
export class ClusterSnapshot extends Schema.Class<ClusterSnapshot>(ClusterSnapshotTypeId)({
  runners: Schema.Array(RunnerInfo),
  shards: Schema.Array(ShardInfo),
  entityTypes: Schema.Array(EntityTypeInfo),
  entityInstances: Schema.Array(EntityInstanceInfo),
  singletons: Schema.Array(SingletonInfo),
  totalEntityCount: Schema.Number,
  totalShardCount: Schema.Number,
  healthyRunnerCount: Schema.Number
}) {
  /**
   * @since 4.0.0
   */
  readonly [ClusterSnapshotTypeId] = ClusterSnapshotTypeId
}

// -----------------------------------------------------------------------------
// Dashboard Events
// -----------------------------------------------------------------------------

// /**
//  * Events emitted by the cluster dashboard.
//  *
//  * @since 4.0.0
//  * @category models
//  */
// export type ClusterDashboardEvent = Data.TaggedEnum<{
//   readonly EntityTypeRegistered: { readonly entityType: string; readonly registeredAt: number }
//   readonly EntityInstanceCreated: { readonly info: EntityInstanceInfo }
//   readonly EntityInstanceRemoved: { readonly entityId: string; readonly entityType: string; readonly shardId: ShardId }
//   readonly SingletonRegistered: { readonly name: string; readonly shardId: ShardId }
//   readonly SingletonStarted: {
//     readonly name: string
//     readonly shardId: ShardId
//     readonly runnerHost: string
//     readonly runnerPort: number
//   }
//   readonly SingletonStopped: { readonly name: string; readonly shardId: ShardId }
//   readonly ShardAcquired: { readonly shardId: ShardId; readonly runnerHost: string; readonly runnerPort: number }
//   readonly ShardReleased: { readonly shardId: ShardId; readonly runnerHost: string; readonly runnerPort: number }
//   readonly RunnerHealthChanged: { readonly runnerHost: string; readonly runnerPort: number; readonly healthy: boolean }
// }>
//
// /**
//  * @since 4.0.0
//  * @category models
//  */
// export const ClusterDashboardEvent = Data.taggedEnum<ClusterDashboardEvent>()

/**
 * @since 4.0.0
 * @category schemas
 */
export class EntityTypeRegistered extends Schema.Class<EntityTypeRegistered>(
  "effect/unstable/cluster/ClusterDashboardEvent/EntityTypeRegistered"
)({
  _tag: Schema.tag("EntityTypeRegistered"),
  entityType: Schema.String,
  registeredAt: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class EntityInstanceCreated extends Schema.Class<EntityInstanceCreated>(
  "effect/unstable/cluster/ClusterDashboardEvent/EntityInstanceCreated"
)({
  _tag: Schema.tag("EntityInstanceCreated"),
  info: EntityInstanceInfo
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class EntityInstanceRemoved extends Schema.Class<EntityInstanceRemoved>(
  "effect/unstable/cluster/ClusterDashboardEvent/EntityInstanceRemoved"
)({
  _tag: Schema.tag("EntityInstanceRemoved"),
  entityId: Schema.String,
  entityType: Schema.String,
  shardId: ShardId
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class SingletonRegistered extends Schema.Class<SingletonRegistered>(
  "effect/unstable/cluster/ClusterDashboardEvent/SingletonRegistered"
)({
  _tag: Schema.tag("SingletonRegistered"),
  name: Schema.String,
  shardId: ShardId
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class SingletonStarted extends Schema.Class<SingletonStarted>(
  "effect/unstable/cluster/ClusterDashboardEvent/SingletonStarted"
)({
  _tag: Schema.tag("SingletonStarted"),
  name: Schema.String,
  shardId: ShardId,
  runnerHost: Schema.String,
  runnerPort: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class SingletonStopped extends Schema.Class<SingletonStopped>(
  "effect/unstable/cluster/ClusterDashboardEvent/SingletonStopped"
)({
  _tag: Schema.tag("SingletonStopped"),
  name: Schema.String,
  shardId: ShardId
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class ShardAcquired extends Schema.Class<ShardAcquired>(
  "effect/unstable/cluster/ClusterDashboardEvent/ShardAcquired"
)({
  _tag: Schema.tag("ShardAcquired"),
  shardId: ShardId,
  runnerHost: Schema.String,
  runnerPort: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class ShardReleased extends Schema.Class<ShardReleased>(
  "effect/unstable/cluster/ClusterDashboardEvent/ShardReleased"
)({
  _tag: Schema.tag("ShardReleased"),
  shardId: ShardId,
  runnerHost: Schema.String,
  runnerPort: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export class RunnerHealthChanged extends Schema.Class<RunnerHealthChanged>(
  "effect/unstable/cluster/ClusterDashboardEvent/RunnerHealthChanged"
)({
  _tag: Schema.tag("RunnerHealthChanged"),
  runnerHost: Schema.String,
  runnerPort: Schema.Number,
  healthy: Schema.Boolean
}) {}

/**
 * @since 4.0.0
 * @category schemas
 */
export const ClusterDashboardEvent: Schema.Union<
  readonly [
    typeof EntityTypeRegistered,
    typeof EntityInstanceCreated,
    typeof EntityInstanceRemoved,
    typeof SingletonRegistered,
    typeof SingletonStarted,
    typeof SingletonStopped,
    typeof ShardAcquired,
    typeof ShardReleased,
    typeof RunnerHealthChanged
  ]
> = Schema.Union([
  EntityTypeRegistered,
  EntityInstanceCreated,
  EntityInstanceRemoved,
  SingletonRegistered,
  SingletonStarted,
  SingletonStopped,
  ShardAcquired,
  ShardReleased,
  RunnerHealthChanged
])

/**
 * @since 4.0.0
 * @category models
 */
export type ClusterDashboardEvent = typeof ClusterDashboardEvent.Type

// -----------------------------------------------------------------------------
// ClusterDashboard Service
// -----------------------------------------------------------------------------

/**
 * Dashboard client service that aggregates cluster state from all runners.
 *
 * @since 4.0.0
 * @category context
 */
export class ClusterDashboard extends ServiceMap.Service<ClusterDashboard, {
  /**
   * Get aggregated cluster snapshot from all runners.
   */
  readonly getClusterSnapshot: Effect.Effect<ClusterSnapshot>

  /**
   * Get all entity instances across the cluster.
   */
  readonly getEntityInstances: Effect.Effect<ReadonlyArray<EntityInstanceInfo>>

  /**
   * Get all shards and their assignments.
   */
  readonly getShards: Effect.Effect<ReadonlyArray<ShardInfo>>

  /**
   * Get all runners with status.
   */
  readonly getRunners: Effect.Effect<ReadonlyArray<RunnerInfo>>

  /**
   * Get all singletons.
   */
  readonly getSingletons: Effect.Effect<ReadonlyArray<SingletonInfo>>

  /**
   * Subscribe to real-time cluster events (aggregated from all runners).
   */
  readonly subscribe: Stream.Stream<ClusterDashboardEvent>
}>()("effect/cluster/ClusterDashboard") {}
