import { NodeFileSystem } from "@effect/platform-node"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { MutableHashSet } from "effect/collections"
import { Option } from "effect/data"
import { Equal } from "effect/interfaces"
import { FileSystem } from "effect/platform"
import { Runner, RunnerAddress, ShardId, ShardStorage, SqlShardStorage } from "effect/unstable/cluster"
import { MysqlContainer } from "./fixtures/mysql2-utils.ts"
import { PgContainer } from "./fixtures/pg-utils.ts"

const StorageLive = SqlShardStorage.layer

describe("SqlMessageStorage", () => {
  ;([
    ["pg", Layer.orDie(PgContainer.layerClient)],
    ["mysql", Layer.orDie(MysqlContainer.layerClient)],
    ["sqlite", Layer.orDie(SqliteLayer)]
  ] as const).forEach(([label, layer]) => {
    it.layer(StorageLive.pipe(Layer.provideMerge(layer)), {
      timeout: 30000
    })(label, (it) => {
      it.effect("saveRunners", () =>
        Effect.gen(function*() {
          const storage = yield* ShardStorage.ShardStorage

          yield* storage.saveRunners([[
            runnerAddress1,
            Runner.make({
              address: runnerAddress1,
              groups: ["default"],
              version: 1
            })
          ]])
          expect(yield* storage.getRunners).toEqual([[
            runnerAddress1,
            Runner.make({
              address: runnerAddress1,
              groups: ["default"],
              version: 1
            })
          ]])
        }).pipe(Effect.repeat({ times: 2 })))

      it.effect("saveAssignments", () =>
        Effect.gen(function*() {
          const storage = yield* ShardStorage.ShardStorage

          yield* storage.saveAssignments([
            [ShardId.make("default", 1), Option.some(runnerAddress1)],
            [ShardId.make("default", 2), Option.none()]
          ])
          expect(Equal.equals(
            yield* storage.getAssignments,
            MutableHashSet.fromIterable([
              [ShardId.make("default", 1), Option.some(runnerAddress1)],
              [ShardId.make("default", 2), Option.none()]
            ])
          ))
        }).pipe(Effect.repeat({ times: 2 })))

      it.effect("acquireShards", () =>
        Effect.gen(function*() {
          const storage = yield* ShardStorage.ShardStorage

          let acquired = yield* storage.acquire(runnerAddress1, [
            ShardId.make("default", 1),
            ShardId.make("default", 2),
            ShardId.make("default", 3)
          ])
          expect(acquired.map((_) => _.id)).toEqual([1, 2, 3])
          acquired = yield* storage.acquire(runnerAddress1, [
            ShardId.make("default", 1),
            ShardId.make("default", 2),
            ShardId.make("default", 3)
          ])
          expect(acquired.map((_) => _.id)).toEqual([1, 2, 3])

          const refreshed = yield* storage.refresh(runnerAddress1, [
            ShardId.make("default", 1),
            ShardId.make("default", 2),
            ShardId.make("default", 3)
          ])
          expect(refreshed.map((_) => _.id)).toEqual([1, 2, 3])

          acquired = yield* storage.acquire(runnerAddress2, [
            ShardId.make("default", 1),
            ShardId.make("default", 2),
            ShardId.make("default", 3)
          ])
          expect(acquired).toEqual([])
        }))
    })
  })
})

const runnerAddress1 = RunnerAddress.make("localhost", 1234)
const runnerAddress2 = RunnerAddress.make("localhost", 1235)

const SqliteLayer = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const dir = yield* fs.makeTempDirectoryScoped()
  return SqliteClient.layer({
    filename: dir + "/test.db"
  })
}).pipe(Layer.unwrap, Layer.provide(NodeFileSystem.layer))
