import { assert, it } from "@effect/vitest"
import { Effect, Fiber, Latch, Layer } from "effect"
import * as PersistedCacheTest from "effect-test/unstable/persistence/PersistedCacheTest"
import * as PersistedQueueTest from "effect-test/unstable/persistence/PersistedQueueTest"
import { TestClock } from "effect/testing"
import { PersistedQueue, Persistence } from "effect/unstable/persistence"
import { PgContainer } from "./utils.ts"

PersistedCacheTest.suite(
  "sql-pg-multi",
  Persistence.layerSqlMultiTable.pipe(Layer.provide(PgContainer.layerClient))
)

PersistedCacheTest.suite(
  "sql-pg-single",
  Persistence.layerSql.pipe(Layer.provide(PgContainer.layerClient))
)

PersistedQueueTest.suite(
  "sql-pg",
  PersistedQueue.layerStoreSql().pipe(Layer.provide(PgContainer.layerClient))
)

it.layer(PgContainer.layerClient, { timeout: "30 seconds" })("PersistedQueue SQL locks", (it) => {
  it.effect("refreshes locks for acquired elements", () =>
    Effect.gen(function*() {
      const options = {
        tableName: "effect_queue_lock_refresh",
        pollInterval: "10 millis",
        lockRefreshInterval: "100 millis",
        lockExpiration: "1 second"
      } as const
      const store1 = yield* PersistedQueue.makeStoreSql(options)
      const store2 = yield* PersistedQueue.makeStoreSql(options)
      const element = { message: "hello" }

      yield* store1.offer({
        name: "lock-refresh",
        id: crypto.randomUUID(),
        element,
        isCustomId: false
      })

      const acquired = Latch.makeUnsafe()
      const first = yield* Effect.scoped(Effect.gen(function*() {
        yield* store1.take({ name: "lock-refresh", maxAttempts: 10 })
        yield* acquired.open
        return yield* Effect.never
      })).pipe(Effect.forkScoped)

      yield* acquired.await

      const second = yield* Effect.scoped(
        store2.take({ name: "lock-refresh", maxAttempts: 10 })
      ).pipe(Effect.forkScoped)

      yield* Effect.sleep("1500 millis")
      assert.isUndefined(second.pollUnsafe())

      yield* Fiber.interrupt(first)
      const received = yield* Fiber.join(second)
      assert.deepStrictEqual(received.element, element)
    }).pipe(TestClock.withLive))
})
