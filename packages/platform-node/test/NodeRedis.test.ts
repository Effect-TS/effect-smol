import { NodeRedis } from "@effect/platform-node"
import { assert, it } from "@effect/vitest"
import { RedisContainer } from "@testcontainers/redis"
import { Effect, Fiber, Latch, Layer, Schema } from "effect"
import * as PersistedCacheTest from "effect-test/unstable/persistence/PersistedCacheTest"
import * as PersistedQueueTest from "effect-test/unstable/persistence/PersistedQueueTest"
import { TestClock } from "effect/testing"
import { PersistedQueue, Persistence } from "effect/unstable/persistence"

const RedisLayer = Layer.unwrap(
  Effect.gen(function*() {
    const container = yield* Effect.acquireRelease(
      Effect.promise(() => new RedisContainer("redis:alpine").start()),
      (container) => Effect.promise(() => container.stop())
    )
    return NodeRedis.layer({
      host: container.getHost(),
      port: container.getMappedPort(6379)
    })
  }).pipe(
    Effect.catchCause(() => Effect.fail(new PersistedCacheTest.TransientError()))
  )
)

PersistedCacheTest.suite(
  "NodeRedis",
  Persistence.layerRedis.pipe(Layer.provide(RedisLayer))
)

PersistedQueueTest.suite(
  "NodeRedis",
  PersistedQueue.layerStoreRedis().pipe(Layer.provide(RedisLayer))
)

const PersistedQueueRedisLayer = Layer.mergeAll(
  RedisLayer,
  PersistedQueue.layer.pipe(
    Layer.provideMerge(
      PersistedQueue.layerStoreRedis({
        pollInterval: "10 millis"
      }).pipe(Layer.provide(RedisLayer))
    )
  )
)

it.layer(PersistedQueueRedisLayer, { timeout: "30 seconds" })(
  "PersistedQueue (NodeRedis regressions)",
  (it) => {
    it.effect("does not reset locked pending entries back into the queue", () =>
      Effect.gen(function*() {
        const redis = yield* NodeRedis.NodeRedis
        const queueName = "test-redis-reset"
        const itemId = "test-redis-reset-item-1"
        const queueKey = `effectq:${queueName}`
        const pendingKey = `effectq:${queueName}:pending`
        const failedKey = `effectq:${queueName}:failed`
        const idsKey = `effectq:${queueName}:ids`
        const lockKey = `effectq:${itemId}:lock`

        yield* redis.use((client) => client.del(queueKey, pendingKey, failedKey, idsKey, lockKey))
        yield* redis.use((client) =>
          client.hset(
            pendingKey,
            itemId,
            JSON.stringify({
              id: itemId,
              element: { n: 42 },
              attempts: 0
            })
          )
        )
        yield* redis.use((client) => client.set(lockKey, "worker"))

        const queue = yield* PersistedQueue.make({
          name: queueName,
          schema: RedisItem
        })
        const processed = Latch.makeUnsafe(false)
        const fiber = yield* queue.take((item) =>
          Effect.as(
            processed.open,
            item
          )
        ).pipe(Effect.forkScoped)

        yield* Effect.sleep("750 millis").pipe(TestClock.withLive)

        assert.isFalse(processed.isOpen())
        assert.isUndefined(fiber.pollUnsafe())

        yield* Fiber.interrupt(fiber)
      }))

    it.effect("moves exhausted entries to the Redis failed queue", () =>
      Effect.gen(function*() {
        const redis = yield* NodeRedis.NodeRedis
        const queueName = "test-redis-failed"
        const itemId = "test-redis-failed-item-1"
        const queueKey = `effectq:${queueName}`
        const pendingKey = `effectq:${queueName}:pending`
        const failedKey = `effectq:${queueName}:failed`
        const idsKey = `effectq:${queueName}:ids`
        const lockKey = `effectq:${itemId}:lock`

        yield* redis.use((client) => client.del(queueKey, pendingKey, failedKey, idsKey, lockKey))

        const queue = yield* PersistedQueue.make({
          name: queueName,
          schema: RedisItem
        })
        yield* queue.offer({ n: 42 }, { id: itemId })
        const error = yield* queue.take(() => Effect.fail("boom"), { maxAttempts: 1 }).pipe(Effect.flip)

        const failed = yield* redis.use((client) => client.lrange(failedKey, 0, -1))
        assert.strictEqual(error, "boom")
        assert.strictEqual(failed.length, 1)
        const failedItem = JSON.parse(failed[0])
        assert.strictEqual(failedItem.id, itemId)
        assert.deepStrictEqual(failedItem.element, { n: 42 })
        assert.strictEqual(failedItem.attempts, 1)
      }))
  }
)

const RedisItem = Schema.Struct({
  n: Schema.Number
})
