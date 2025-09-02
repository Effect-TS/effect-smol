/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import * as MutableHashMap from "../../collections/MutableHashMap.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { PersistenceError } from "./ClusterError.ts"
import { Runner } from "./Runner.ts"
import { RunnerAddress } from "./RunnerAddress.ts"
import { ShardId } from "./ShardId.ts"

/**
 * Represents a generic interface to the persistent storage required by the
 * cluster.
 *
 * @since 4.0.0
 * @category models
 */
export class ShardStorage extends ServiceMap.Key<ShardStorage, {
  /**
   * Get the current assignments of shards to runners.
   */
  readonly getAssignments: Effect.Effect<
    Array<[ShardId, RunnerAddress | undefined]>,
    PersistenceError
  >

  /**
   * Save the current state of shards assignments to runners.
   */
  readonly saveAssignments: (
    assignments: Iterable<readonly [ShardId, RunnerAddress | undefined]>
  ) => Effect.Effect<void, PersistenceError>

  /**
   * Get all runners registered with the cluster.
   */
  readonly getRunners: Effect.Effect<Array<[RunnerAddress, Runner]>, PersistenceError>

  /**
   * Save the current runners registered with the cluster.
   */
  readonly saveRunners: (runners: Iterable<readonly [RunnerAddress, Runner]>) => Effect.Effect<void, PersistenceError>

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
   * Locks expire after 15 seconds, so this method should be called every 10
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
   * Get the current assignments of shards to runners.
   */
  readonly getAssignments: Effect.Effect<
    Array<
      readonly [
        shardId: string,
        runnerAddress: string | null
      ]
    >,
    PersistenceError
  >

  /**
   * Save the current state of shards assignments to runners.
   */
  readonly saveAssignments: (
    assignments: Array<readonly [shardId: string, RunnerAddress: string | null]>
  ) => Effect.Effect<void, PersistenceError>

  /**
   * Get all runners registered with the cluster.
   */
  readonly getRunners: Effect.Effect<Array<readonly [address: string, runner: string]>, PersistenceError>

  /**
   * Save the current runners registered with the cluster.
   */
  readonly saveRunners: (
    runners: Array<readonly [address: string, runner: string]>
  ) => Effect.Effect<void, PersistenceError>

  /**
   * Acquire the lock on the given shards, returning the shards that were
   * successfully locked.
   */
  readonly acquire: (
    address: string,
    shardIds: ReadonlyArray<string>
  ) => Effect.Effect<Array<string>, PersistenceError>

  /**
   * Refresh the lock on the given shards, returning the shards that were
   * successfully locked.
   */
  readonly refresh: (
    address: string,
    shardIds: ReadonlyArray<string>
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
  ShardStorage.of({
    getAssignments: Effect.map(encoded.getAssignments, (assignments) => {
      const arr = Arr.empty<[ShardId, RunnerAddress | undefined]>()
      for (const [shardId, runnerAddress] of assignments) {
        arr.push([
          ShardId.fromString(shardId),
          runnerAddress === null ? undefined : decodeRunnerAddress(runnerAddress)
        ])
      }
      return arr
    }),
    saveAssignments: (assignments) => {
      const arr = Arr.empty<readonly [string, string | null]>()
      for (const [shardId, runnerAddress] of assignments) {
        arr.push([
          shardId.toString(),
          runnerAddress === undefined ? null : encodeRunnerAddress(runnerAddress)
        ])
      }
      return encoded.saveAssignments(arr)
    },
    getRunners: Effect.gen(function*() {
      const runners = yield* encoded.getRunners
      const results: Array<[RunnerAddress, Runner]> = []
      for (let i = 0; i < runners.length; i++) {
        const [address, runner] = runners[i]
        try {
          results.push([decodeRunnerAddress(address), Runner.decodeSync(runner)])
        } catch {
          //
        }
      }
      return results
    }),
    saveRunners: (runners) =>
      Effect.suspend(() =>
        encoded.saveRunners(
          Array.from(runners, ([address, runner]) => [encodeRunnerAddress(address), Runner.encodeSync(runner)])
        )
      ),
    acquire: (address, shardIds) => {
      const arr = Array.from(shardIds, (id) => id.toString())
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
export const layerNoop: Layer.Layer<ShardStorage> = Layer.sync(ShardStorage)(
  () => {
    let acquired: Array<ShardId> = []
    return ShardStorage.of({
      getAssignments: Effect.sync(() => []),
      saveAssignments: () => Effect.void,
      getRunners: Effect.sync(() => []),
      saveRunners: () => Effect.void,
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
  const assignments = MutableHashMap.empty<ShardId, RunnerAddress | undefined>()
  const runners = MutableHashMap.empty<RunnerAddress, Runner>()

  function saveAssignments(value: Iterable<readonly [ShardId, RunnerAddress | undefined]>) {
    return Effect.sync(() => {
      for (const [shardId, runnerAddress] of value) {
        MutableHashMap.set(assignments, shardId, runnerAddress)
      }
    })
  }

  function saveRunners(value: Iterable<readonly [RunnerAddress, Runner]>) {
    return Effect.sync(() => {
      for (const [address, runner] of value) {
        MutableHashMap.set(runners, address, runner)
      }
    })
  }

  let acquired: Array<ShardId> = []

  return ShardStorage.of({
    getAssignments: Effect.sync(() => Array.from(assignments)),
    saveAssignments,
    getRunners: Effect.sync(() => Array.from(runners)),
    saveRunners,
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
export const layerMemory: Layer.Layer<ShardStorage> = Layer.effect(ShardStorage)(makeMemory)

// -------------------------------------------------------------------------------------
// internal
// -------------------------------------------------------------------------------------

const encodeRunnerAddress = (runnerAddress: RunnerAddress) => `${runnerAddress.host}:${runnerAddress.port}`

const decodeRunnerAddress = (runnerAddress: string): RunnerAddress => {
  const [host, port] = runnerAddress.split(":")
  return new RunnerAddress({ host, port: Number(port) })
}
