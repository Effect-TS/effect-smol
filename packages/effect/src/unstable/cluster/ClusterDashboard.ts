/**
 * @since 4.0.0
 */
import type * as Effect from "../../Effect.ts"
import * as Schema from "../../Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Stream from "../../Stream.ts"
import { ShardId } from "./ShardId.ts"

// -----------------------------------------------------------------------------
// Domain Models
// -----------------------------------------------------------------------------

/**
 * Information about an active entity instance.
 *
 * @since 4.0.0
 * @category schemas
 */
export class EntityInstanceInfo extends Schema.Class<EntityInstanceInfo>(
  "effect/unstable/cluster/EntityInstanceInfo"
)({
  entityId: Schema.String,
  entityType: Schema.String,
  shardId: ShardId,
  runnerHost: Schema.String,
  runnerPort: Schema.Number,
  activeRequestCount: Schema.Number,
  mailboxSize: Schema.Number,
  lastActiveAt: Schema.Number,
  keepAliveEnabled: Schema.Boolean
}) {}

/**
 * Information about a registered entity type.
 *
 * @since 4.0.0
 * @category schemas
 */
export class EntityTypeInfo extends Schema.Class<EntityTypeInfo>(
  "effect/unstable/cluster/EntityTypeInfo"
)({
  entityType: Schema.String,
  activeInstanceCount: Schema.Number,
  registeredAt: Schema.Number
}) {}

/**
 * Status of a shard.
 *
 * @since 4.0.0
 * @category schemas
 */
export const ShardStatus = Schema.Literals([
  "assigned",
  "acquiring",
  "releasing",
  "unassigned"
])

/**
 * @since 4.0.0
 * @category schemas
 */
export type ShardStatus = typeof ShardStatus.Type

/**
 * Information about a shard.
 *
 * @since 4.0.0
 * @category schemas
 */
export class ShardInfo extends Schema.Class<ShardInfo>(
  "effect/unstable/cluster/ShardInfo"
)({
  shardId: ShardId,
  runnerHost: Schema.String,
  runnerPort: Schema.Number,
  status: ShardStatus,
  entityCount: Schema.Number
}) {}

/**
 * Information about a runner.
 *
 * @since 4.0.0
 * @category schemas
 */
export class RunnerInfo extends Schema.Class<RunnerInfo>(
  "effect/unstable/cluster/RunnerInfo"
)({
  host: Schema.String,
  port: Schema.Number,
  groups: Schema.Array(Schema.String),
  weight: Schema.Number,
  healthy: Schema.Boolean,
  shardCount: Schema.Number,
  entityCount: Schema.Number
}) {}

/**
 * Information about a singleton.
 *
 * @since 4.0.0
 * @category schemas
 */
export class SingletonInfo extends Schema.Class<SingletonInfo>(
  "effect/unstable/cluster/SingletonInfo"
)({
  name: Schema.String,
  shardId: ShardId,
  running: Schema.Boolean,
  runnerHost: Schema.optional(Schema.String),
  runnerPort: Schema.optional(Schema.Number)
}) {}

/**
 * Snapshot of a runner's state for dashboard purposes.
 *
 * @since 4.0.0
 * @category schemas
 */
export class RunnerSnapshot extends Schema.Class<RunnerSnapshot>(
  "effect/unstable/cluster/RunnerSnapshot"
)({
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
}) {}

/**
 * Aggregated snapshot of cluster state.
 *
 * @since 4.0.0
 * @category schemas
 */
export class ClusterSnapshot extends Schema.Class<ClusterSnapshot>(
  "effect/unstable/cluster/ClusterSnapshot"
)({
  runners: Schema.Array(RunnerInfo),
  shards: Schema.Array(ShardInfo),
  entityTypes: Schema.Array(EntityTypeInfo),
  entityInstances: Schema.Array(EntityInstanceInfo),
  singletons: Schema.Array(SingletonInfo),
  totalEntityCount: Schema.Number,
  totalShardCount: Schema.Number,
  healthyRunnerCount: Schema.Number
}) {}

// -----------------------------------------------------------------------------
// Dashboard Events
// -----------------------------------------------------------------------------

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
 * @category services
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
