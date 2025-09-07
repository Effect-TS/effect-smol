import { assert, describe, it } from "@effect/vitest"
import type { Layer } from "effect"
import { Effect, Exit } from "effect"
import { Schema } from "effect/schema"
import { Persistable, PersistedCache, Persistence } from "effect/unstable/persistence"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String
}) {}

class TTLRequest extends Persistable.Class<{
  payload: { id: number }
}>()("TTLRequest", {
  primaryKey: (req) => `TTLRequest:${req.id}`,
  success: User,
  error: Schema.String
}) {}

describe("PersistedCache", () => {
  const testsuite = (storeId: "memory", layer: Layer.Layer<Persistence.Persistence, unknown>) =>
    it.effect(storeId, () =>
      Effect.gen(function*() {
        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: "users" })
        let invocations = 0
        let cache = yield* PersistedCache.make({
          storeId: "users",
          lookup: (req: TTLRequest) =>
            Effect.sync(() => {
              invocations++
              return new User({ id: req.id, name: "John" })
            }),
          timeToLive: () => 5000
        })
        const user = yield* cache.get(new TTLRequest({ id: 1 }))
        assert.deepStrictEqual(user, new User({ id: 1, name: "John" }))
        assert.deepStrictEqual(
          yield* store.get(new TTLRequest({ id: 1 })),
          Exit.succeed(new User({ id: 1, name: "John" }))
        )
        assert.strictEqual(invocations, 1)
        assert.deepStrictEqual(yield* cache.get(new TTLRequest({ id: 1 })), new User({ id: 1, name: "John" }))
        assert.strictEqual(invocations, 1)

        cache = yield* PersistedCache.make({
          storeId: "users",
          lookup: (req: TTLRequest) =>
            Effect.sync(() => {
              invocations++
              return new User({ id: req.id, name: "John" })
            }),
          timeToLive: (_req, _exit) => 5000
        })
        assert.deepStrictEqual(yield* cache.get(new TTLRequest({ id: 1 })), new User({ id: 1, name: "John" }))
        assert.strictEqual(invocations, 1)
      }).pipe(Effect.provide(layer)))

  testsuite("memory", Persistence.layerMemory)
})
