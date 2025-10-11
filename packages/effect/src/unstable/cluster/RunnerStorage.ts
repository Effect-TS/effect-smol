/**
 * @since 4.0.0
 */
import { isArrayNonEmpty, type NonEmptyArray } from "../../collections/Array.ts"
import * as MutableHashMap from "../../collections/MutableHashMap.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { PersistenceError } from "./ClusterError.ts"
import * as MachineId from "./MachineId.ts"
import { Runner } from "./Runner.ts"
import type { RunnerAddress } from "./RunnerAddress.ts"
import { ShardId } from "./ShardId.ts"

/**
 * Represents a generic interface to the persistent storage required by the
 * cluster.
 *
 * @since 4.0.0
 * @category models
 */
export class RunnerStorage extends ServiceMap.Service<RunnerStorage, {
  /**
   * Register a new runner with the cluster.
   */
  readonly register: (runner: Runner, healthy: boolean) => Effect.Effect<MachineId.MachineId, PersistenceError>

  /**
   * Unregister the runner with the given address.
   */
  readonly unregister: (address: RunnerAddress) => Effect.Effect<void, PersistenceError>

  /**
   * Get all runners registered with the cluster.
   */
  readonly getRunners: Effect.Effect<Array<readonly [runner: Runner, healthy: boolean]>, PersistenceError>

  /**
   * Set the health status of the given runner.
   */
  readonly setRunnerHealth: (address: RunnerAddress, healthy: boolean) => Effect.Effect<void, PersistenceError>

  /**
   * Try to acquire the given shard ids for processing.
   *
   * It returns an array of shards it was able to acquire.
   */
  readonly acquire: (
    address: RunnerAddress,
    shardIds: Iterable<ShardId>
  ) => Effect.Effect<Array<ShardId>, PersistenceError>

  /**
   * Refresh the locks owned by the given runner.
   *
   * Locks expire after 5 seconds, so this method should be called every 4
   * seconds to keep the locks alive.
   */
  readonly refresh: (
    address: RunnerAddress,
    shardIds: Iterable<ShardId>
  ) => Effect.Effect<Array<ShardId>, PersistenceError>

  /**
   * Release the given shard ids.
   */
  readonly release: (
    address: RunnerAddress,
    shardId: ShardId
  ) => Effect.Effect<void, PersistenceError>

  /**
   * Release all the shards assigned to the given runner.
   */
  readonly releaseAll: (address: RunnerAddress) => Effect.Effect<void, PersistenceError>
}>()("effect/cluster/ShardStorage") {}

/**
 * @since 4.0.0
 * @category Encoded
 */
export interface Encoded {
  /**
   * Get all runners registered with the cluster.
   */
  readonly getRunners: Effect.Effect<Array<readonly [runner: string, healthy: boolean]>, PersistenceError>

  /**
   * Register a new runner with the cluster.
   */
  readonly register: (address: string, runner: string, healthy: boolean) => Effect.Effect<number, PersistenceError>

  /**
   * Unregister the runner with the given address.
   */
  readonly unregister: (address: string) => Effect.Effect<void, PersistenceError>

  /**
   * Set the health status of the given runner.
   */
  readonly setRunnerHealth: (address: string, healthy: boolean) => Effect.Effect<void, PersistenceError>

  /**
   * Acquire the lock on the given shards, returning the shards that were
   * successfully locked.
   */
  readonly acquire: (
    address: string,
    shardIds: NonEmptyArray<string>
  ) => Effect.Effect<Array<string>, PersistenceError>

  /**
   * Refresh the lock on the given shards, returning the shards that were
   * successfully locked.
   */
  readonly refresh: (
    address: string,
    shardIds: Array<string>
  ) => Effect.Effect<Array<string>, PersistenceError>

  /**
   * Release the lock on the given shard.
   */
  readonly release: (
    address: string,
    shardId: string
  ) => Effect.Effect<void, PersistenceError>

  /**
   * Release the lock on all shards for the given runner.
   */
  readonly releaseAll: (address: string) => Effect.Effect<void, PersistenceError>
}

/**
 * @since 4.0.0
 * @category layers
 */
export const makeEncoded = (encoded: Encoded) =>
  RunnerStorage.of({
    getRunners: Effect.gen(function*() {
      const runners = yield* encoded.getRunners
      const results: Array<[Runner, boolean]> = []
      for (let i = 0; i < runners.length; i++) {
        const [runner, healthy] = runners[i]
        try {
          results.push([Runner.decodeSync(runner), healthy])
        } catch {
          //
        }
      }
      return results
    }),
    register: (runner, healthy) =>
      Effect.map(
        encoded.register(encodeRunnerAddress(runner.address), Runner.encodeSync(runner), healthy),
        MachineId.make
      ),
    unregister: (address) => encoded.unregister(encodeRunnerAddress(address)),
    setRunnerHealth: (address, healthy) => encoded.setRunnerHealth(encodeRunnerAddress(address), healthy),
    acquire: (address, shardIds) => {
      const arr = Array.from(shardIds, (id) => id.toString())
      if (!isArrayNonEmpty(arr)) return Effect.succeed([])
      return encoded.acquire(encodeRunnerAddress(address), arr).pipe(
        Effect.map((shards) => shards.map(ShardId.fromString))
      )
    },
    refresh: (address, shardIds) => {
      const arr = Array.from(shardIds, (id) => id.toString())
      return encoded.refresh(encodeRunnerAddress(address), arr).pipe(
        Effect.map((shards) => shards.map(ShardId.fromString))
      )
    },
    release(address, shardId) {
      return encoded.release(encodeRunnerAddress(address), shardId.toString())
    },
    releaseAll(address) {
      return encoded.releaseAll(encodeRunnerAddress(address))
    }
  })

/**
 * @since 4.0.0
 * @category layers
 */
export const layerNoop: Layer.Layer<RunnerStorage> = Layer.sync(RunnerStorage)(
  () => {
    let acquired: Array<ShardId> = []
    let id = 0
    return RunnerStorage.of({
      getRunners: Effect.sync(() => []),
      register: () => Effect.sync(() => MachineId.make(id++)),
      unregister: () => Effect.void,
      setRunnerHealth: () => Effect.void,
      acquire: (_address, shards) => {
        acquired = Array.from(shards)
        return Effect.succeed(Array.from(shards))
      },
      refresh: () => Effect.sync(() => acquired),
      release: () => Effect.void,
      releaseAll: () => Effect.void
    })
  }
)

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeMemory = Effect.gen(function*() {
  const runners = MutableHashMap.empty<RunnerAddress, Runner>()
  let acquired: Array<ShardId> = []
  let id = 0

  return RunnerStorage.of({
    getRunners: Effect.sync(() => Array.from(MutableHashMap.values(runners), (runner) => [runner, true])),
    register: (runner) =>
      Effect.sync(() => {
        MutableHashMap.set(runners, runner.address, runner)
        return MachineId.make(id++)
      }),
    unregister: (address) =>
      Effect.sync(() => {
        MutableHashMap.remove(runners, address)
      }),
    setRunnerHealth: () => Effect.void,
    acquire: (_address, shardIds) => {
      acquired = Array.from(shardIds)
      return Effect.succeed(Array.from(shardIds))
    },
    refresh: () => Effect.sync(() => acquired),
    release: () => Effect.void,
    releaseAll: () => Effect.void
  })
})

/**
 * @since 4.0.0
 * @category layers
 */
export const layerMemory: Layer.Layer<RunnerStorage> = Layer.effect(RunnerStorage)(makeMemory)

// -------------------------------------------------------------------------------------
// internal
// -------------------------------------------------------------------------------------

const encodeRunnerAddress = (runnerAddress: RunnerAddress) => `${runnerAddress.host}:${runnerAddress.port}`
