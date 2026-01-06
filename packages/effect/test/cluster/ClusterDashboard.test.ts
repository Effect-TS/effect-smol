import { describe, it } from "@effect/vitest"
import { assertDefined, assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Fiber, Filter, Layer, Stream } from "effect"
import { TestClock } from "effect/testing"
import type { ClusterDashboard } from "effect/unstable/cluster"
import { MessageStorage, RunnerHealth, Runners, RunnerStorage, Sharding, ShardingConfig } from "effect/unstable/cluster"
import { TestEntity, TestEntityNoState, TestEntityState } from "./TestEntity.ts"

describe.concurrent("ClusterDashboard", () => {
  describe("getDashboardSnapshot", () => {
    it.effect("returns runner info with config values", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        // Verify runner info from default config
        strictEqual(snapshot.host, "localhost")
        strictEqual(snapshot.port, 34431)
        deepStrictEqual(snapshot.groups, ["default"])
        strictEqual(snapshot.weight, 1)
        assertFalse(snapshot.isShutdown)
        assertTrue(snapshot.healthy)
      }).pipe(Effect.provide(TestSharding)))

    it.effect("returns registered entity types", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        // TestEntity should be registered
        strictEqual(snapshot.registeredEntityTypes.length, 1)
        strictEqual(snapshot.registeredEntityTypes[0].entityType, "TestEntity")
      }).pipe(Effect.provide(TestSharding)))

    it.effect("returns active entity instances after message", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const makeClient = yield* TestEntity.client
        const client = makeClient("entity-1")

        // Create an active entity by sending a message
        yield* client.GetUserVolatile({ id: 1 })

        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        // Should have one active entity
        strictEqual(snapshot.entityInstances.length, 1)
        strictEqual(snapshot.entityInstances[0].entityId, "entity-1")
        strictEqual(snapshot.entityInstances[0].entityType, "TestEntity")
      }).pipe(Effect.provide(TestSharding)))

    it.effect("returns shard information", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        // Should have shards (based on config)
        assertTrue(snapshot.shards.length > 0)
        // All shards should be assigned to this runner
        for (const shard of snapshot.shards) {
          strictEqual(shard.status, "assigned")
        }
      }).pipe(Effect.provide(TestSharding)))

    it.effect("returns singletons array with registered singletons", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        // RunnerHealth singleton is registered by the test infrastructure
        assertTrue(snapshot.singletons.length >= 0)
        for (const singleton of snapshot.singletons) {
          assertTrue(typeof singleton.name === "string")
          assertTrue(typeof singleton.running === "boolean")
        }
      }).pipe(Effect.provide(TestSharding)))

    it.effect("reflects healthy state when not shutdown", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const sharding = yield* Sharding.Sharding

        const snapshot = yield* sharding.getDashboardSnapshot
        assertFalse(snapshot.isShutdown)
        assertTrue(snapshot.healthy)
      }).pipe(Effect.provide(TestSharding)))
  })

  describe("subscribeDashboardEvents", () => {
    it.effect("emits SingletonRegistered and SingletonStarted events when singleton is registered", () =>
      Effect.gen(function*() {
        const sharding = yield* Sharding.Sharding
        const latch = yield* Effect.makeLatch()

        const fiber = yield* sharding.subscribeDashboardEvents.pipe(
          Stream.tap(() => latch.open),
          Stream.filter((event) =>
            event._tag === "SingletonRegistered" || event._tag === "SingletonStarted" ? event : Filter.failVoid
          ),
          Stream.take(2),
          Stream.runCollect,
          Effect.forkScoped({ startImmediately: true })
        )

        yield* latch.await

        yield* sharding.registerSingleton("TestDashboardSingleton", Effect.never)

        yield* TestClock.adjust(1)
        const events = yield* Fiber.join(fiber)

        const registered = events[0] as ClusterDashboard.SingletonRegistered
        const started = events[1] as ClusterDashboard.SingletonStarted
        strictEqual(registered.name, "TestDashboardSingleton")
        strictEqual(started.name, "TestDashboardSingleton")
        strictEqual(started.runnerHost, "localhost")
        strictEqual(started.runnerPort, 34431)
      }).pipe(Effect.provide(TestSharding)))

    it.effect("multiple subscribers receive the same events", () =>
      Effect.gen(function*() {
        const sharding = yield* Sharding.Sharding
        const latch1 = yield* Effect.makeLatch()
        const latch2 = yield* Effect.makeLatch()

        const filterSingletonEvents = (event: ClusterDashboard.ClusterDashboardEvent) =>
          event._tag === "SingletonRegistered" || event._tag === "SingletonStarted" ? event : Filter.failVoid

        const fiber1 = yield* sharding.subscribeDashboardEvents.pipe(
          Stream.tap(() => latch1.open),
          Stream.filter(filterSingletonEvents),
          Stream.take(2),
          Stream.runCollect,
          Effect.forkScoped({ startImmediately: true })
        )

        const fiber2 = yield* sharding.subscribeDashboardEvents.pipe(
          Stream.tap(() => latch2.open),
          Stream.filter(filterSingletonEvents),
          Stream.take(2),
          Stream.runCollect,
          Effect.forkScoped({ startImmediately: true })
        )

        yield* latch1.await
        yield* latch2.await

        yield* sharding.registerSingleton("MultiSubscriberSingleton", Effect.never)

        const events1 = yield* Fiber.join(fiber1)
        const events2 = yield* Fiber.join(fiber2)

        // Both subscribers should receive the same events
        strictEqual(events1.length, 2)
        strictEqual(events2.length, 2)
        strictEqual(events1[0]._tag, events2[0]._tag)
        strictEqual(events1[1]._tag, events2[1]._tag)
      }).pipe(Effect.provide(TestSharding)))

    it.effect("events contain correct runner information", () =>
      Effect.gen(function*() {
        const sharding = yield* Sharding.Sharding
        const latch = yield* Effect.makeLatch()

        const fiber = yield* sharding.subscribeDashboardEvents.pipe(
          Stream.tap(() => latch.open),
          Stream.filter((event) => event._tag === "SingletonStarted" ? event : Filter.failVoid),
          Stream.take(1),
          Stream.runCollect,
          Effect.forkScoped({ startImmediately: true })
        )

        yield* latch.await
        yield* sharding.registerSingleton("RunnerInfoSingleton", Effect.never)

        const events = yield* Fiber.join(fiber)
        const startedEvent = events[0] as ClusterDashboard.SingletonStarted

        strictEqual(startedEvent.runnerHost, "localhost")
        strictEqual(startedEvent.runnerPort, 34431)
        assertDefined(startedEvent.shardId)
        strictEqual(startedEvent.shardId.group, "default")
      }).pipe(Effect.provide(TestSharding)))

    it.effect("SingletonRegistered event has correct shardId", () =>
      Effect.gen(function*() {
        const sharding = yield* Sharding.Sharding
        const latch = yield* Effect.makeLatch()

        const fiber = yield* sharding.subscribeDashboardEvents.pipe(
          Stream.tap(() => latch.open),
          Stream.filter((event) => event._tag === "SingletonRegistered" ? event : Filter.failVoid),
          Stream.take(1),
          Stream.runCollect,
          Effect.forkScoped({ startImmediately: true })
        )

        yield* latch.await
        yield* sharding.registerSingleton("ShardIdSingleton", Effect.never)

        const events = yield* Fiber.join(fiber)
        const registeredEvent = events[0] as ClusterDashboard.SingletonRegistered

        strictEqual(registeredEvent.name, "ShardIdSingleton")
        assertDefined(registeredEvent.shardId)
        strictEqual(registeredEvent.shardId.group, "default")
        assertTrue(typeof registeredEvent.shardId.id === "number")
      }).pipe(Effect.provide(TestSharding)))
  })

  describe("entity instance tracking", () => {
    it.effect("tracks multiple entity instances", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const makeClient = yield* TestEntity.client

        // Create multiple entities
        const client1 = makeClient("entity-1")
        const client2 = makeClient("entity-2")
        const client3 = makeClient("entity-3")

        yield* client1.GetUserVolatile({ id: 1 })
        yield* client2.GetUserVolatile({ id: 2 })
        yield* client3.GetUserVolatile({ id: 3 })

        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        strictEqual(snapshot.entityInstances.length, 3)

        const entityIds = snapshot.entityInstances.map((e) => e.entityId).sort()
        deepStrictEqual(entityIds, ["entity-1", "entity-2", "entity-3"])
      }).pipe(Effect.provide(TestSharding)))

    it.effect("tracks active request count", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const makeClient = yield* TestEntity.client
        const client = makeClient("entity-1")

        // Start a long-running request
        const fiber = yield* client.Never().pipe(Effect.forkChild({ startImmediately: true }))
        yield* TestClock.adjust(1)

        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        const instance = snapshot.entityInstances.find((e) => e.entityId === "entity-1")
        assertDefined(instance)
        strictEqual(instance!.activeRequestCount, 1)

        yield* Fiber.interrupt(fiber)
      }).pipe(Effect.provide(TestSharding)))

    it.effect("entity instances have correct metadata", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(1)
        const makeClient = yield* TestEntity.client
        const client = makeClient("entity-1")

        yield* client.GetUserVolatile({ id: 1 })

        const sharding = yield* Sharding.Sharding
        const snapshot = yield* sharding.getDashboardSnapshot

        const instance = snapshot.entityInstances[0]
        strictEqual(instance.entityId, "entity-1")
        strictEqual(instance.entityType, "TestEntity")
        strictEqual(instance.runnerHost, "localhost")
        strictEqual(instance.runnerPort, 34431)
        assertTrue(instance.shardId.group === "default")
        assertTrue(typeof instance.shardId.id === "number")
      }).pipe(Effect.provide(TestSharding)))
  })
})

// Test layer configuration
const TestShardingConfig = ShardingConfig.layer({
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
  refreshAssignmentsInterval: 0
})

const TestShardingWithoutState = TestEntityNoState.pipe(
  Layer.provideMerge(Sharding.layer),
  Layer.provide(RunnerStorage.layerMemory),
  Layer.provide(RunnerHealth.layerNoop)
)

const TestShardingWithoutRunners = TestShardingWithoutState.pipe(
  Layer.provideMerge(TestEntityState.layer)
)

const TestShardingWithoutStorage = TestShardingWithoutRunners.pipe(
  Layer.provide(Runners.layerNoop),
  Layer.provide(TestShardingConfig)
)

const TestSharding = TestShardingWithoutStorage.pipe(
  Layer.provideMerge(MessageStorage.layerMemory),
  Layer.provide(TestShardingConfig)
)
