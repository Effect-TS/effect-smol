import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Option, Redacted, Schema } from "effect"
import { HttpSession } from "effect/unstable/http"
import { Persistence } from "effect/unstable/persistence"

const SessionMetaSchema = Schema.Struct({
  createdAt: Schema.Number,
  expiresAt: Schema.Number,
  lastRefreshedAt: Schema.Number
})

const SessionMetaKey = HttpSession.key({
  id: "meta",
  schema: SessionMetaSchema
})

const CorruptSessionMetaKey = HttpSession.key({
  id: "meta",
  schema: Schema.Struct({
    createdAt: Schema.String,
    expiresAt: Schema.String,
    lastRefreshedAt: Schema.String
  })
})

const ValueKey = HttpSession.key({
  id: "value",
  schema: Schema.String
})

const toStoreId = (sessionId: HttpSession.SessionId) => `session:${Redacted.value(sessionId)}`

describe("HttpSession", () => {
  it.effect("regenerates session id when metadata is missing", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const previousId = HttpSession.SessionId("previous")
        const newId = HttpSession.SessionId("new")

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(previousId)),
          generateSessionId: Effect.succeed(newId)
        })

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(newId))

        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: toStoreId(newId) })
        const metadata = yield* store.get(SessionMetaKey)
        assert.isTrue(metadata !== undefined && metadata._tag === "Success")
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("regenerates session id when metadata is corrupt", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const previousId = HttpSession.SessionId("previous")
        const newId = HttpSession.SessionId("new")
        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: toStoreId(previousId) })

        yield* store.set(
          CorruptSessionMetaKey,
          Exit.succeed({
            createdAt: "bad",
            expiresAt: "bad",
            lastRefreshedAt: "bad"
          })
        )

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(previousId)),
          generateSessionId: Effect.succeed(newId)
        })

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(newId))
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("regenerates session id when metadata is expired", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const previousId = HttpSession.SessionId("previous")
        const newId = HttpSession.SessionId("new")
        const now = yield* Effect.clockWith((clock) => Effect.succeed(clock.currentTimeMillisUnsafe()))
        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: toStoreId(previousId) })

        yield* store.set(
          SessionMetaKey,
          Exit.succeed({
            createdAt: now - 1_000,
            expiresAt: now - 1,
            lastRefreshedAt: now - 1_000
          })
        )

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(previousId)),
          generateSessionId: Effect.succeed(newId)
        })

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(newId))
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("regenerates session id when metadata contains non-finite timestamps", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const previousId = HttpSession.SessionId("previous")
        const newId = HttpSession.SessionId("new")
        const now = yield* Effect.clockWith((clock) => Effect.succeed(clock.currentTimeMillisUnsafe()))
        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: toStoreId(previousId) })

        yield* store.set(
          SessionMetaKey,
          Exit.succeed({
            createdAt: now,
            expiresAt: Number.POSITIVE_INFINITY,
            lastRefreshedAt: now
          })
        )

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(previousId)),
          generateSessionId: Effect.succeed(newId)
        })

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(newId))
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("revalidates metadata before write operations", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const firstId = HttpSession.SessionId("first")
        const secondId = HttpSession.SessionId("second")
        const generatedIds = [firstId, secondId]
        let index = 0

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.none()),
          generateSessionId: Effect.sync(() => generatedIds[index++]!)
        })

        const persistence = yield* Persistence.Persistence
        const firstStore = yield* persistence.make({ storeId: toStoreId(firstId) })
        yield* firstStore.remove(SessionMetaKey)

        yield* session.set(ValueKey, "value")

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(secondId))

        const firstValue = yield* firstStore.get(ValueKey)
        assert.strictEqual(firstValue, undefined)

        const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
        const secondValue = yield* secondStore.get(ValueKey)
        assert.isTrue(secondValue !== undefined && secondValue._tag === "Success")
        if (secondValue !== undefined && secondValue._tag === "Success") {
          assert.strictEqual(secondValue.value, "value")
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("revalidates metadata before read operations", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const firstId = HttpSession.SessionId("first")
        const secondId = HttpSession.SessionId("second")
        const generatedIds = [firstId, secondId]
        let index = 0

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.none()),
          generateSessionId: Effect.sync(() => generatedIds[index++]!)
        })

        const persistence = yield* Persistence.Persistence
        const firstStore = yield* persistence.make({ storeId: toStoreId(firstId) })
        yield* firstStore.set(ValueKey, Exit.succeed("stale"))
        yield* firstStore.remove(SessionMetaKey)

        const value = yield* session.get(ValueKey)
        assert.isTrue(Option.isNone(value))
        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(secondId))
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))
})
