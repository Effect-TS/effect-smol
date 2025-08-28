/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import * as Iterable from "../../collections/Iterable.ts"
import * as MutableHashMap from "../../collections/MutableHashMap.ts"
import * as MutableHashSet from "../../collections/MutableHashSet.ts"
import * as Config_ from "../../config/Config.ts"
import * as ConfigProvider from "../../config/ConfigProvider.ts"
import * as Data from "../../data/Data.ts"
import * as Option from "../../data/Option.ts"
import * as Deferred from "../../Deferred.ts"
import * as Effect from "../../Effect.ts"
import * as FiberSet from "../../FiberSet.ts"
import { identity } from "../../Function.ts"
import * as Equal from "../../interfaces/Equal.ts"
import * as Layer from "../../Layer.ts"
import * as Metric from "../../observability/Metric.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as Schedule from "../../Schedule.ts"
import * as Schema from "../../schema/Schema.ts"
import type { Scope } from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Clock from "../../time/Clock.ts"
import * as Duration from "../../time/Duration.ts"
import * as Rpc from "../rpc/Rpc.ts"
import * as RpcClient from "../rpc/RpcClient.ts"
import * as RpcGroup from "../rpc/RpcGroup.ts"
import * as RpcServer from "../rpc/RpcServer.ts"
import { RunnerNotRegistered } from "./ClusterError.ts"
import * as ClusterMetrics from "./ClusterMetrics.ts"
import { addAllNested, decideAssignmentsForShards, State } from "./internal/shardManager.ts"
import * as MachineId from "./MachineId.ts"
import { make as makeRunner, Runner } from "./Runner.ts"
import { RunnerAddress } from "./RunnerAddress.ts"
import * as RunnerHealth from "./RunnerHealth.ts"
import type { Runners } from "./Runners.ts"
import { RpcClientProtocol } from "./Runners.ts"
import { make as makeShardId, ShardId } from "./ShardId.ts"
import { ShardingConfig } from "./ShardingConfig.ts"
import { ShardStorage } from "./ShardStorage.ts"

/**
 * @since 4.0.0
 * @category models
 */
export class ShardManager extends ServiceMap.Key<ShardManager, {
  /**
   * Get all shard assignments.
   */
  readonly getAssignments: Effect.Effect<
    Iterable<readonly [ShardId, Option.Option<RunnerAddress>]>
  >
  /**
   * Get a stream of sharding events emit by the shard manager.
   */
  readonly shardingEvents: (
    address: Option.Option<RunnerAddress>
  ) => Effect.Effect<PubSub.Subscription<ShardingEvent>, never, Scope>
  /**
   * Register a new runner with the cluster.
   */
  readonly register: (runner: Runner) => Effect.Effect<MachineId.MachineId>
  /**
   * Unregister a runner from the cluster.
   */
  readonly unregister: (address: RunnerAddress) => Effect.Effect<void>
  /**
   * Rebalance shards assigned to runners within the cluster.
   */
  readonly rebalance: Effect.Effect<void>
  /**
   * Notify the cluster of an unhealthy runner.
   */
  readonly notifyUnhealthyRunner: (address: RunnerAddress) => Effect.Effect<void>
  /**
   * Check and repot on the health of all runners in the cluster.
   */
  readonly checkRunnerHealth: Effect.Effect<void>
}>()("effect/cluster/ShardManager") {}

/**
 * @since 4.0.0
 * @category Config
 */
export class Config extends ServiceMap.Key<Config, {
  /**
   * The duration to wait before rebalancing shards after a change.
   */
  readonly rebalanceDebounce: Duration.DurationInput
  /**
   * The interval on which regular rebalancing of shards will occur.
   */
  readonly rebalanceInterval: Duration.DurationInput
  /**
   * The interval on which rebalancing of shards which failed to be
   * rebalanced will be retried.
   */
  readonly rebalanceRetryInterval: Duration.DurationInput
  /**
   * The maximum ratio of shards to rebalance at once.
   *
   * **Note**: this value should be a number between `0` and `1`.
   */
  readonly rebalanceRate: number
  /**
   * The interval on which persistence of Runners will be retried if it fails.
   */
  readonly persistRetryInterval: Duration.DurationInput
  /**
   * The number of times persistence of Runners will be retried if it fails.
   */
  readonly persistRetryCount: number
  /**
   * The interval on which Runner health will be checked.
   */
  readonly runnerHealthCheckInterval: Duration.DurationInput
  /**
   * The length of time to wait for a Runner to respond to a ping.
   */
  readonly runnerPingTimeout: Duration.DurationInput
}>()("effect/cluster/ShardManager/Config") {
  /**
   * @since 4.0.0
   */
  static readonly defaults: Config["Service"] = {
    rebalanceDebounce: Duration.seconds(3),
    rebalanceInterval: Duration.seconds(20),
    rebalanceRetryInterval: Duration.seconds(10),
    rebalanceRate: 2 / 100,
    persistRetryCount: 100,
    persistRetryInterval: Duration.seconds(3),
    runnerHealthCheckInterval: Duration.minutes(1),
    runnerPingTimeout: Duration.seconds(3)
  }
}

/**
 * @since 4.0.0
 * @category Config
 */
export const configConfig: Config_.Config<Config["Service"]> = Config_.all({
  rebalanceDebounce: Config_.duration("rebalanceDebounce").pipe(
    Config_.withDefault(() => Config.defaults.rebalanceDebounce)
    // Config_.withDescription("The duration to wait before rebalancing shards after a change.")
  ),
  rebalanceInterval: Config_.duration("rebalanceInterval").pipe(
    Config_.withDefault(() => Config.defaults.rebalanceInterval)
    // Config_.withDescription("The interval on which regular rebalancing of shards will occur.")
  ),
  rebalanceRetryInterval: Config_.duration("rebalanceRetryInterval").pipe(
    Config_.withDefault(() => Config.defaults.rebalanceRetryInterval)
    // Config_.withDescription(
    //   "The interval on which rebalancing of shards which failed to be rebalanced will be retried."
    // )
  ),
  rebalanceRate: Config_.number("rebalanceRate").pipe(
    Config_.withDefault(() => Config.defaults.rebalanceRate)
    // Config_.withDescription("The maximum ratio of shards to rebalance at once.")
  ),
  persistRetryCount: Config_.int("persistRetryCount").pipe(
    Config_.withDefault(() => Config.defaults.persistRetryCount)
    // Config_.withDescription("The number of times persistence of runners will be retried if it fails.")
  ),
  persistRetryInterval: Config_.duration("persistRetryInterval").pipe(
    Config_.withDefault(() => Config.defaults.persistRetryInterval)
    // Config_.withDescription("The interval on which persistence of runners will be retried if it fails.")
  ),
  runnerHealthCheckInterval: Config_.duration("runnerHealthCheckInterval").pipe(
    Config_.withDefault(() => Config.defaults.runnerHealthCheckInterval)
    // Config_.withDescription("The interval on which runner health will be checked.")
  ),
  runnerPingTimeout: Config_.duration("runnerPingTimeout").pipe(
    Config_.withDefault(() => Config.defaults.runnerPingTimeout)
    // Config_.withDescription("The length of time to wait for a runner to respond to a ping.")
  )
})

/**
 * @since 4.0.0
 * @category Config
 */
export const configFromEnv: Effect.Effect<Config["Service"], Config_.ConfigError> = configConfig.asEffect().pipe(
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnv().pipe(
      ConfigProvider.constantCase
    )
  )
)

/**
 * @since 4.0.0
 * @category Config
 */
export const layerConfig = (config?: Partial<Config["Service"]> | undefined): Layer.Layer<Config> =>
  Layer.succeed(Config)({
    ...Config.defaults,
    ...config
  })

/**
 * @since 4.0.0
 * @category Config
 */
export const layerConfigFromEnv = (
  config?: Partial<Config["Service"]> | undefined
): Layer.Layer<Config, Config_.ConfigError> =>
  Layer.effect(Config)(config ? Effect.map(configFromEnv, (env) => ({ ...env, ...config })) : configFromEnv)

/**
 * Represents a client which can be used to communicate with the
 * `ShardManager`.
 *
 * @since 4.0.0
 * @category Client
 */
export class ShardManagerClient extends ServiceMap.Key<ShardManagerClient, {
  /**
   * Register a new runner with the cluster.
   */
  readonly register: (
    address: RunnerAddress,
    groups: ReadonlyArray<string>
  ) => Effect.Effect<MachineId.MachineId>
  /**
   * Unregister a runner from the cluster.
   */
  readonly unregister: (address: RunnerAddress) => Effect.Effect<void>
  /**
   * Notify the cluster of an unhealthy runner.
   */
  readonly notifyUnhealthyRunner: (address: RunnerAddress) => Effect.Effect<void>
  /**
   * Get all shard assignments.
   */
  readonly getAssignments: Effect.Effect<
    Iterable<readonly [ShardId, Option.Option<RunnerAddress>]>
  >
  /**
   * Get a stream of sharding events emit by the shard manager.
   */
  readonly shardingEvents: (
    address: Option.Option<RunnerAddress>
  ) => Effect.Effect<Queue.Dequeue<ShardingEvent>, never, Scope>
  /**
   * Get the current time on the shard manager.
   */
  readonly getTime: Effect.Effect<number>
}>()("effect/cluster/ShardManager/ShardManagerClient") {}

/**
 * @since 4.0.0
 * @category models
 */
export const ShardingEventSchema = Schema.Union([
  Schema.TaggedStruct("StreamStarted", {}),
  Schema.TaggedStruct("ShardsAssigned", {
    address: RunnerAddress,
    shards: Schema.Array(ShardId)
  }),
  Schema.TaggedStruct("ShardsUnassigned", {
    address: RunnerAddress,
    shards: Schema.Array(ShardId)
  }),
  Schema.TaggedStruct("RunnerRegistered", {
    address: RunnerAddress
  }),
  Schema.TaggedStruct("RunnerUnregistered", {
    address: RunnerAddress
  })
]) satisfies Schema.Codec<ShardingEvent, any>

/**
 * The messaging protocol for the `ShardManager`.
 *
 * @since 4.0.0
 * @category Rpcs
 */
export class Rpcs extends RpcGroup.make(
  Rpc.make("Register", {
    payload: { runner: Runner },
    success: MachineId.MachineId
  }),
  Rpc.make("Unregister", {
    payload: { address: RunnerAddress }
  }),
  Rpc.make("NotifyUnhealthyRunner", {
    payload: { address: RunnerAddress }
  }),
  Rpc.make("GetAssignments", {
    success: Schema.Array(Schema.Tuple([ShardId, Schema.Option(RunnerAddress)]))
  }),
  Rpc.make("ShardingEvents", {
    payload: { address: Schema.Option(RunnerAddress) },
    success: ShardingEventSchema,
    stream: true
  }),
  Rpc.make("GetTime", {
    success: Schema.Number
  })
) {}

/**
 * @since 4.0.0
 * @category models
 */
export type ShardingEvent = Data.TaggedEnum<{
  StreamStarted: {}
  ShardsAssigned: {
    address: RunnerAddress
    shards: ReadonlyArray<ShardId>
  }
  ShardsUnassigned: {
    address: RunnerAddress
    shards: ReadonlyArray<ShardId>
  }
  RunnerRegistered: { address: RunnerAddress }
  RunnerUnregistered: { address: RunnerAddress }
}>

/**
 * @since 4.0.0
 * @category models
 */
export const ShardingEvent = Data.taggedEnum<ShardingEvent>()

/**
 * @since 4.0.0
 * @category Client
 */
export const makeClientLocal = Effect.gen(function*() {
  const config = yield* ShardingConfig
  const clock = yield* Clock.Clock

  const groups = new Set<string>()
  const shards = MutableHashMap.empty<ShardId, Option.Option<RunnerAddress>>()

  let machineId = 0

  return ShardManagerClient.of({
    register: (_, groupsToAdd) =>
      Effect.sync(() => {
        for (const group of groupsToAdd) {
          if (groups.has(group)) continue
          groups.add(group)
          for (let n = 1; n <= config.shardsPerGroup; n++) {
            MutableHashMap.set(shards, makeShardId(group, n), config.runnerAddress)
          }
        }
        return MachineId.make(++machineId)
      }),
    unregister: () => Effect.void,
    notifyUnhealthyRunner: () => Effect.void,
    getAssignments: Effect.succeed(shards),
    shardingEvents: Effect.fnUntraced(function*(_address) {
      const queue = yield* Queue.make<ShardingEvent>()
      yield* Queue.offer(queue, ShardingEvent.StreamStarted())
      return queue
    }),
    getTime: clock.currentTimeMillis
  })
})

/**
 * @since 4.0.0
 * @category Client
 */
export const makeClientRpc: Effect.Effect<
  ShardManagerClient["Service"],
  never,
  ShardingConfig | RpcClient.Protocol | Scope
> = Effect.gen(function*() {
  const config = yield* ShardingConfig
  const client = yield* RpcClient.make(Rpcs, {
    spanPrefix: "ShardManagerClient",
    disableTracing: true
  })

  return ShardManagerClient.of({
    register: (address, groups) =>
      client.Register({ runner: makeRunner({ address, version: config.serverVersion, groups }) }).pipe(
        Effect.orDie
      ),
    unregister: (address) => Effect.orDie(client.Unregister({ address })),
    notifyUnhealthyRunner: (address) => Effect.orDie(client.NotifyUnhealthyRunner({ address })),
    getAssignments: Effect.orDie(client.GetAssignments()),
    shardingEvents: (address) =>
      Queue.make<ShardingEvent>().pipe(
        Effect.tap(Effect.fnUntraced(
          function*(queue) {
            const events = yield* client.ShardingEvents({ address }, { asQueue: true })
            const take = Effect.orDie(Queue.takeAll(events))
            while (true) {
              Queue.unsafeOfferAll(queue, yield* take)
            }
          },
          (effect, queue) => Queue.into(effect, queue as any),
          (effect) => Effect.forkScoped(effect)
        ))
      ),
    getTime: Effect.orDie(client.GetTime())
  })
})

/**
 * @since 4.0.0
 * @category Client
 */
export const layerClientLocal: Layer.Layer<
  ShardManagerClient,
  never,
  ShardingConfig
> = Layer.effect(ShardManagerClient)(makeClientLocal)

/**
 * @since 4.0.0
 * @category Client
 */
export const layerClientRpc: Layer.Layer<
  ShardManagerClient,
  never,
  ShardingConfig | RpcClientProtocol
> = Layer.effect(ShardManagerClient)(makeClientRpc).pipe(
  Layer.provide(
    Layer.effect(RpcClient.Protocol)(
      Effect.gen(function*() {
        const config = yield* ShardingConfig
        const clientProtocol = yield* RpcClientProtocol
        return yield* clientProtocol(config.shardManagerAddress)
      })
    )
  )
)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = Effect.gen(function*() {
  const storage = yield* ShardStorage
  const runnerHealthApi = yield* RunnerHealth.RunnerHealth
  const clock = yield* Clock.Clock
  const config = yield* Config
  const shardingConfig = yield* ShardingConfig

  const state = yield* Effect.orDie(State.fromStorage(shardingConfig.shardsPerGroup))
  const scope = yield* Effect.scope
  const events = yield* PubSub.unbounded<ShardingEvent>()

  function updateRunnerMetrics() {
    ClusterMetrics.runners.unsafeUpdate(MutableHashMap.size(state.allRunners), ServiceMap.empty())
  }

  function updateShardMetrics() {
    const stats = state.shardStats
    for (const [address, shardCount] of stats.perRunner) {
      ClusterMetrics.assignedShards.unsafeUpdate(
        shardCount,
        Metric.CurrentMetricAttributes.serviceMap({ address })
      )
    }
    ClusterMetrics.unassignedShards.unsafeUpdate(stats.unassigned, ServiceMap.empty())
  }
  updateShardMetrics()

  function withRetry<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<void, never, R> {
    return effect.pipe(
      Effect.retry({
        schedule: Schedule.spaced(config.persistRetryCount),
        times: config.persistRetryCount
      }),
      Effect.ignore
    )
  }

  const persistRunners = Effect.unsafeMakeSemaphore(1).withPermits(1)(withRetry(
    Effect.suspend(() =>
      storage.saveRunners(
        Iterable.map(state.allRunners, ([address, runner]) => [address, runner.runner])
      )
    )
  ))

  const persistAssignments = Effect.unsafeMakeSemaphore(1).withPermits(1)(withRetry(
    Effect.suspend(() => storage.saveAssignments(state.assignments))
  ))

  const notifyUnhealthyRunner = Effect.fnUntraced(function*(address: RunnerAddress) {
    if (!MutableHashMap.has(state.allRunners, address)) return

    if (!(yield* runnerHealthApi.isAlive(address))) {
      yield* Effect.logWarning(`Runner at address '${address.toString()}' is not alive`)
      yield* unregister(address)
    }
  })

  function updateShardsState(
    shards: Iterable<ShardId>,
    address: Option.Option<RunnerAddress>
  ): Effect.Effect<void, RunnerNotRegistered> {
    return Effect.suspend(() => {
      if (Option.isSome(address) && !MutableHashMap.has(state.allRunners, address.value)) {
        return Effect.fail(new RunnerNotRegistered({ address: address.value }))
      }
      state.addAssignments(shards, address)
      return Effect.void
    })
  }

  const getAssignments = Effect.sync(() => state.assignments)

  let machineId = 0
  const register = Effect.fnUntraced(function*(runner: Runner) {
    yield* Effect.logInfo(`Registering runner ${Runner.pretty(runner)}`)

    const current = MutableHashMap.get(state.allRunners, runner.address).pipe(
      Option.filter((r) => r.runner.version === runner.version)
    )
    if (Option.isSome(current)) {
      return MachineId.make(++machineId)
    }

    state.addRunner(runner, clock.unsafeCurrentTimeMillis())
    updateRunnerMetrics()
    yield* PubSub.publish(events, ShardingEvent.RunnerRegistered({ address: runner.address }))
    yield* Effect.forkIn(persistRunners, scope)
    yield* Effect.forkIn(rebalance, scope)
    return MachineId.make(++machineId)
  })

  const unregister = Effect.fnUntraced(function*(address: RunnerAddress) {
    if (!MutableHashMap.has(state.allRunners, address)) return

    yield* Effect.logInfo("Unregistering runner at address:", address)
    const unassignments = Arr.empty<ShardId>()
    for (const [shard, runner] of state.assignments) {
      if (Option.isSome(runner) && Equal.equals(runner.value, address)) {
        unassignments.push(shard)
      }
    }
    state.addAssignments(unassignments, Option.none())
    state.removeRunner(address)
    updateRunnerMetrics()

    if (unassignments.length > 0) {
      yield* PubSub.publish(events, ShardingEvent.RunnerUnregistered({ address }))
    }

    yield* Effect.forkIn(persistRunners, scope)
    yield* Effect.forkIn(rebalance, scope)
  })

  let rebalancing = false
  let rebalanceDeferred: Deferred.Deferred<void> | undefined
  const rebalanceFibers = yield* FiberSet.make()

  const rebalance = Effect.suspend(() => {
    if (!rebalancing) {
      rebalancing = true
      return rebalanceLoop
    }
    if (!rebalanceDeferred) {
      rebalanceDeferred = Deferred.unsafeMake()
    }
    return Deferred.await(rebalanceDeferred)
  })

  const rebalanceLoop: Effect.Effect<void> = Effect.suspend(() => {
    const deferred = rebalanceDeferred
    rebalanceDeferred = undefined
    return runRebalance.pipe(
      deferred ? Deferred.into(deferred) : identity,
      Effect.onExit(() => {
        if (!rebalanceDeferred) {
          rebalancing = false
          return Effect.void
        }
        return Effect.forkIn(rebalanceLoop, scope)
      })
    )
  })

  const runRebalance = Effect.gen(function*() {
    yield* Effect.sleep(config.rebalanceDebounce)

    if (state.shards.size === 0) {
      yield* Effect.logDebug("No shards to rebalance")
      return
    } else if (MutableHashMap.size(state.allRunners) === 0) {
      yield* Effect.logDebug("No runners to rebalance")
      return
    }

    // Determine which shards to assign and unassign
    const assignments = MutableHashMap.empty<RunnerAddress, MutableHashSet.MutableHashSet<ShardId>>()
    const unassignments = MutableHashMap.empty<RunnerAddress, MutableHashSet.MutableHashSet<ShardId>>()
    const changes = MutableHashSet.empty<RunnerAddress>()
    for (const group of state.shards.keys()) {
      const [groupAssignments, groupUnassignments, groupChanges] = decideAssignmentsForShards(state, group)
      for (const [address, shards] of groupAssignments) {
        addAllNested(assignments, address, Array.from(shards, (id) => makeShardId(group, id)))
      }
      for (const [address, shards] of groupUnassignments) {
        addAllNested(unassignments, address, Array.from(shards, (id) => makeShardId(group, id)))
      }
      for (const address of groupChanges) {
        MutableHashSet.add(changes, address)
      }
    }

    yield* Effect.logDebug(`Rebalancing shards`)

    if (MutableHashSet.size(changes) === 0) return

    yield* Metric.update(ClusterMetrics.rebalances, 1)

    // Ping runners first and remove unhealthy ones
    const failedRunners = MutableHashSet.empty<RunnerAddress>()
    for (const address of changes) {
      yield* FiberSet.run(
        rebalanceFibers,
        Effect.flatMap(runnerHealthApi.isAlive(address), (isAlive) => {
          if (isAlive) return Effect.void
          MutableHashSet.add(failedRunners, address)
          MutableHashMap.remove(assignments, address)
          MutableHashMap.remove(unassignments, address)
          return Effect.void
        }),
        { startImmediately: true }
      )
    }
    yield* FiberSet.awaitEmpty(rebalanceFibers)

    const failedUnassignments = new Set<ShardId>()
    for (const [address, shards] of unassignments) {
      yield* FiberSet.run(
        rebalanceFibers,
        updateShardsState(shards, Option.none()).pipe(
          Effect.matchEffect({
            onFailure: () => {
              MutableHashSet.add(failedRunners, address)
              for (const shard of shards) {
                failedUnassignments.add(shard)
              }
              // Remove failed runners from the assignments
              MutableHashMap.remove(assignments, address)
              return Effect.void
            },
            onSuccess: () =>
              PubSub.publish(events, ShardingEvent.ShardsUnassigned({ address, shards: Array.from(shards) }))
          })
        ),
        { startImmediately: true }
      )
    }
    yield* FiberSet.awaitEmpty(rebalanceFibers)

    // Remove failed shard unassignments from the assignments
    MutableHashMap.forEach(assignments, (shards, address) => {
      for (const shard of failedUnassignments) {
        MutableHashSet.remove(shards, shard)
      }
      if (MutableHashSet.size(shards) === 0) {
        MutableHashMap.remove(assignments, address)
      }
    })

    // Perform the assignments
    for (const [address, shards] of assignments) {
      yield* FiberSet.run(
        rebalanceFibers,
        updateShardsState(shards, Option.some(address)).pipe(
          Effect.matchEffect({
            onFailure: () => {
              MutableHashSet.add(failedRunners, address)
              return Effect.void
            },
            onSuccess: () =>
              PubSub.publish(events, ShardingEvent.ShardsAssigned({ address, shards: Array.from(shards) }))
          })
        ),
        { startImmediately: true }
      )
    }
    yield* FiberSet.awaitEmpty(rebalanceFibers)

    updateShardMetrics()

    const wereFailures = MutableHashSet.size(failedRunners) > 0
    if (wereFailures) {
      // Check if the failing runners are still reachable
      yield* Effect.forEach(failedRunners, notifyUnhealthyRunner, { discard: true }).pipe(
        Effect.forkIn(scope)
      )
      yield* Effect.logWarning("Failed to rebalance runners: ", failedRunners)
    }

    if (wereFailures) {
      // Try rebalancing again later if there were any failures
      yield* Effect.sleep(config.rebalanceRetryInterval).pipe(
        Effect.flatMap(() => rebalance),
        Effect.forkIn(scope)
      )
    }

    yield* persistAssignments
  }).pipe(Effect.withSpan("ShardManager.rebalance", undefined, { captureStackTrace: false }))

  const checkRunnerHealth: Effect.Effect<void> = Effect.suspend(() =>
    Effect.forEach(MutableHashMap.keys(state.allRunners), notifyUnhealthyRunner, {
      concurrency: 10,
      discard: true
    })
  )

  yield* Effect.addFinalizer(() =>
    persistAssignments.pipe(
      Effect.catchCause((cause) => Effect.logWarning("Failed to persist assignments on shutdown", cause)),
      Effect.flatMap(() =>
        persistRunners.pipe(
          Effect.catchCause((cause) => Effect.logWarning("Failed to persist runners on shutdown", cause))
        )
      )
    )
  )

  yield* Effect.forkIn(persistRunners, scope)

  // Start a regular cluster rebalance at the configured interval
  yield* rebalance.pipe(
    Effect.andThen(Effect.sleep(config.rebalanceInterval)),
    Effect.forever,
    Effect.forkIn(scope)
  )

  yield* checkRunnerHealth.pipe(
    Effect.andThen(Effect.sleep(config.runnerHealthCheckInterval)),
    Effect.forever,
    Effect.forkIn(scope)
  )

  yield* Effect.gen(function*() {
    const queue = yield* PubSub.subscribe(events)
    while (true) {
      yield* Effect.logInfo("Shard manager event:", yield* PubSub.take(queue))
    }
  }).pipe(Effect.forkIn(scope))

  yield* Effect.logInfo("Shard manager initialized")

  return ShardManager.of({
    getAssignments,
    shardingEvents: (address) =>
      Effect.flatMap(
        Option.isSome(address) ? runnerHealthApi.onConnection(address.value) : Effect.void,
        () => PubSub.subscribe(events)
      ),
    register,
    unregister,
    rebalance,
    notifyUnhealthyRunner,
    checkRunnerHealth
  })
})

/**
 * @since 4.0.0
 * @category layer
 */
export const layer: Layer.Layer<
  ShardManager,
  never,
  ShardStorage | RunnerHealth.RunnerHealth | Runners | Config | ShardingConfig
> = Layer.effect(ShardManager)(make)

/**
 * @since 4.0.0
 * @category Server
 */
export const layerServerHandlers = Rpcs.toLayer(Effect.gen(function*() {
  const shardManager = yield* ShardManager
  const clock = yield* Clock.Clock
  return {
    Register: ({ runner }) => shardManager.register(runner),
    Unregister: ({ address }) => shardManager.unregister(address),
    NotifyUnhealthyRunner: ({ address }) => shardManager.notifyUnhealthyRunner(address),
    GetAssignments: () =>
      Effect.map(
        shardManager.getAssignments,
        (assignments) => Array.from(assignments)
      ),
    ShardingEvents: Effect.fnUntraced(function*({ address }) {
      const sub = yield* shardManager.shardingEvents(address)
      const queue = yield* Queue.make<ShardingEvent>()

      yield* Queue.offer(queue, ShardingEvent.StreamStarted())

      yield* PubSub.takeAll(sub).pipe(
        Effect.flatMap((events) => Queue.offerAll(queue, events)),
        Effect.forever,
        Effect.forkScoped
      )

      return queue
    }),
    GetTime: () => clock.currentTimeMillis
  }
}))

/**
 * @since 4.0.0
 * @category Server
 */
export const layerServer: Layer.Layer<
  never,
  never,
  ShardManager | RpcServer.Protocol
> = RpcServer.layer(Rpcs, {
  spanPrefix: "ShardManager",
  disableTracing: true
}).pipe(Layer.provide(layerServerHandlers))
