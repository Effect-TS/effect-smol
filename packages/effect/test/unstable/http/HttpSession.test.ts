import { assert, describe, it } from "@effect/vitest"
import { Clock, DateTime, Duration, Effect, Exit, Option, Redacted, Schema } from "effect"
import { TestClock } from "effect/testing"
import { Cookies, HttpServerResponse, HttpSession } from "effect/unstable/http"
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
        const metadata = yield* store.get(HttpSession.SessionMeta.key)
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

  it.effect("revalidates metadata before remove operations", () =>
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

        yield* session.remove(ValueKey)

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(secondId))

        const firstValue = yield* firstStore.get(ValueKey)
        assert.isTrue(firstValue !== undefined && firstValue._tag === "Success")
        if (firstValue !== undefined && firstValue._tag === "Success") {
          assert.strictEqual(firstValue.value, "stale")
        }

        const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
        const secondValue = yield* secondStore.get(ValueKey)
        assert.strictEqual(secondValue, undefined)
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("revalidates metadata before clear operations", () =>
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

        yield* session.clear

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(secondId))

        const firstValue = yield* firstStore.get(ValueKey)
        assert.isTrue(firstValue !== undefined && firstValue._tag === "Success")
        if (firstValue !== undefined && firstValue._tag === "Success") {
          assert.strictEqual(firstValue.value, "stale")
        }

        const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
        const secondMeta = yield* secondStore.get(HttpSession.SessionMeta.key)
        assert.strictEqual(secondMeta, undefined)
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("rotates session id and keeps the resolved service usable", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const firstId = HttpSession.SessionId("first")
        const secondId = HttpSession.SessionId("second")
        const thirdId = HttpSession.SessionId("third")
        const generatedIds = [secondId, thirdId]
        let index = 0

        const persistence = yield* Persistence.Persistence

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(firstId)),
          generateSessionId: Effect.sync(() => generatedIds[index++]!)
        })

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(secondId))

        const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })

        yield* session.set(ValueKey, "stale")
        yield* session.rotate

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(thirdId))

        const secondMeta = yield* secondStore.get(SessionMetaKey)
        assert.strictEqual(secondMeta, undefined)
        const secondValue = yield* secondStore.get(ValueKey)
        assert.strictEqual(secondValue, undefined)

        yield* session.set(ValueKey, "fresh")

        const thirdStore = yield* persistence.make({ storeId: toStoreId(thirdId) })
        const thirdMeta = yield* thirdStore.get(HttpSession.SessionMeta.key)
        assert.isTrue(thirdMeta !== undefined && thirdMeta._tag === "Success")

        const thirdValue = yield* thirdStore.get(ValueKey)
        assert.isTrue(thirdValue !== undefined && thirdValue._tag === "Success")
        if (thirdValue !== undefined && thirdValue._tag === "Success") {
          assert.strictEqual(thirdValue.value, "fresh")
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("rotates even when clearing the previous store fails", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const firstId = HttpSession.SessionId("first")
        const secondId = HttpSession.SessionId("second")
        const thirdId = HttpSession.SessionId("third")
        const generatedIds = [secondId, thirdId]
        let index = 0

        const basePersistence = yield* Persistence.Persistence
        const secondStore = yield* basePersistence.make({ storeId: toStoreId(secondId) })

        const wrappedPersistence = Persistence.Persistence.of({
          make: (options) =>
            Effect.map(
              basePersistence.make(options),
              (store) =>
                options.storeId === toStoreId(secondId)
                  ? {
                    ...store,
                    clear: Effect.fail(new Persistence.PersistenceError({ message: "clear failed" }))
                  }
                  : store
            )
        })

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(firstId)),
          generateSessionId: Effect.sync(() => generatedIds[index++]!)
        }).pipe(Effect.provideService(Persistence.Persistence, wrappedPersistence))

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(secondId))

        yield* session.set(ValueKey, "stale")
        yield* session.rotate

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(thirdId))

        const secondValue = yield* secondStore.get(ValueKey)
        assert.isTrue(secondValue !== undefined && secondValue._tag === "Success")
        if (secondValue !== undefined && secondValue._tag === "Success") {
          assert.strictEqual(secondValue.value, "stale")
        }

        yield* session.set(ValueKey, "fresh")

        const thirdStore = yield* basePersistence.make({ storeId: toStoreId(thirdId) })
        const thirdMeta = yield* thirdStore.get(HttpSession.SessionMeta.key)
        assert.isTrue(thirdMeta !== undefined && thirdMeta._tag === "Success")
        const thirdValue = yield* thirdStore.get(ValueKey)
        assert.isTrue(thirdValue !== undefined && thirdValue._tag === "Success")
        if (thirdValue !== undefined && thirdValue._tag === "Success") {
          assert.strictEqual(thirdValue.value, "fresh")
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("keeps state consistent when rotate generates the current id", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const firstId = HttpSession.SessionId("first")
        const secondId = HttpSession.SessionId("second")
        const generatedIds = [firstId, secondId]
        let index = 0

        const persistence = yield* Persistence.Persistence
        const firstStore = yield* persistence.make({ storeId: toStoreId(firstId) })
        const now = yield* DateTime.now
        yield* firstStore.set(
          HttpSession.SessionMeta.key,
          Exit.succeed(
            new HttpSession.SessionMeta({
              createdAt: now,
              expiresAt: DateTime.addDuration(now, Duration.days(1)),
              lastRefreshedAt: now
            })
          )
        )

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(firstId)),
          generateSessionId: Effect.sync(() => generatedIds[index++] ?? secondId)
        })

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(firstId))

        yield* session.set(ValueKey, "stale")
        yield* session.rotate

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(firstId))

        yield* session.set(ValueKey, "fresh")

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(firstId))

        const firstMeta = yield* firstStore.get(HttpSession.SessionMeta.key)
        assert.isTrue(firstMeta !== undefined && firstMeta._tag === "Success")

        const firstValue = yield* firstStore.get(ValueKey)
        assert.isTrue(firstValue !== undefined && firstValue._tag === "Success")
        if (firstValue !== undefined && firstValue._tag === "Success") {
          assert.strictEqual(firstValue.value, "fresh")
        }

        const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
        const secondMeta = yield* secondStore.get(HttpSession.SessionMeta.key)
        assert.strictEqual(secondMeta, undefined)
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("refreshes metadata when updateAge threshold is reached", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const sessionId = HttpSession.SessionId("refresh")
        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(sessionId)),
          expiresIn: Duration.minutes(10),
          updateAge: Duration.minutes(2)
        })

        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: toStoreId(session.id.current) })
        const before = yield* store.get(HttpSession.SessionMeta.key)
        assert.isTrue(before !== undefined && before._tag === "Success")

        if (before !== undefined && before._tag === "Success") {
          yield* TestClock.adjust(Duration.minutes(2))
          yield* session.state

          const after = yield* store.get(HttpSession.SessionMeta.key)
          assert.isTrue(after !== undefined && after._tag === "Success")
          if (after !== undefined && after._tag === "Success") {
            assert.isTrue(after.value.lastRefreshedAt.epochMillis > before.value.lastRefreshedAt.epochMillis)
            assert.isTrue(after.value.expiresAt.epochMillis > before.value.expiresAt.epochMillis)
          }
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("does not refresh metadata when refresh is disabled", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const sessionId = HttpSession.SessionId("no-refresh")
        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(sessionId)),
          expiresIn: Duration.minutes(10),
          updateAge: Duration.minutes(1),
          disableRefresh: true
        })

        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: toStoreId(session.id.current) })
        const before = yield* store.get(HttpSession.SessionMeta.key)
        assert.isTrue(before !== undefined && before._tag === "Success")

        if (before !== undefined && before._tag === "Success") {
          yield* TestClock.adjust(Duration.minutes(5))
          yield* session.state

          const after = yield* store.get(HttpSession.SessionMeta.key)
          assert.isTrue(after !== undefined && after._tag === "Success")
          if (after !== undefined && after._tag === "Success") {
            assert.strictEqual(after.value.lastRefreshedAt.epochMillis, before.value.lastRefreshedAt.epochMillis)
            assert.strictEqual(after.value.expiresAt.epochMillis, before.value.expiresAt.epochMillis)
          }
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("clamps updateAge to expiresIn", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const sessionId = HttpSession.SessionId("clamp")
        const persistence = yield* Persistence.Persistence
        const now = yield* Effect.clockWith((clock) => Effect.succeed(clock.currentTimeMillisUnsafe()))
        const previousLastRefreshedAt = now - Duration.toMillis(Duration.minutes(2))
        const store = yield* persistence.make({ storeId: toStoreId(sessionId) })

        yield* store.set(
          HttpSession.SessionMeta.key,
          Exit.succeed(
            new HttpSession.SessionMeta({
              createdAt: DateTime.makeUnsafe(now - Duration.toMillis(Duration.minutes(10))),
              expiresAt: DateTime.makeUnsafe(now + Duration.toMillis(Duration.minutes(10))),
              lastRefreshedAt: DateTime.makeUnsafe(previousLastRefreshedAt)
            })
          )
        )

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(sessionId)),
          expiresIn: Duration.minutes(1),
          updateAge: Duration.minutes(5)
        })

        assert.strictEqual(Redacted.value(session.id.current), Redacted.value(sessionId))

        const after = yield* store.get(HttpSession.SessionMeta.key)
        assert.isTrue(after !== undefined && after._tag === "Success")
        if (after !== undefined && after._tag === "Success") {
          assert.isTrue(after.value.lastRefreshedAt.epochMillis > previousLastRefreshedAt)
          assert.isTrue(after.value.expiresAt.epochMillis <= now + Duration.toMillis(Duration.minutes(2)))
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("bounds data key ttl to metadata expiration horizon", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const sessionId = HttpSession.SessionId("ttl")
        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.some(sessionId)),
          expiresIn: Duration.minutes(2),
          disableRefresh: true
        })

        yield* session.set(ValueKey, "value")

        const persistence = yield* Persistence.Persistence
        const store = yield* persistence.make({ storeId: toStoreId(session.id.current) })
        const before = yield* store.get(ValueKey)
        assert.isTrue(before !== undefined && before._tag === "Success")

        yield* TestClock.adjust(Duration.minutes(2))

        const after = yield* store.get(ValueKey)
        assert.strictEqual(after, undefined)
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("supports setCookie helper overrides for sameSite and path", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.none()),
          generateSessionId: Effect.succeed(HttpSession.SessionId("helper-overrides")),
          cookie: {
            name: "session_token",
            sameSite: "strict",
            path: "/"
          }
        })

        const response = yield* HttpSession.setCookie(HttpServerResponse.empty(), {
          path: "/auth",
          sameSite: "none"
        }).pipe(Effect.provideService(HttpSession.HttpSession, session))

        const cookie = Cookies.get(response.cookies, "session_token")
        assert.isTrue(cookie !== undefined)
        if (cookie !== undefined) {
          assert.strictEqual(cookie.options?.path, "/auth")
          assert.strictEqual(cookie.options?.sameSite, "none")
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("defaults secure/httpOnly to true and allows helper overrides", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.none()),
          generateSessionId: Effect.succeed(HttpSession.SessionId("helper-defaults"))
        })

        const defaultResponse = yield* HttpSession.setCookie(HttpServerResponse.empty(), {
          path: "/default"
        }).pipe(Effect.provideService(HttpSession.HttpSession, session))

        const overriddenResponse = yield* HttpSession.setCookie(HttpServerResponse.empty(), {
          secure: false,
          httpOnly: false
        }).pipe(Effect.provideService(HttpSession.HttpSession, session))

        const defaultCookie = Cookies.get(defaultResponse.cookies, "sid")
        assert.isTrue(defaultCookie !== undefined)
        if (defaultCookie !== undefined) {
          assert.strictEqual(defaultCookie.options?.secure, true)
          assert.strictEqual(defaultCookie.options?.httpOnly, true)
        }

        const overriddenCookie = Cookies.get(overriddenResponse.cookies, "sid")
        assert.isTrue(overriddenCookie !== undefined)
        if (overriddenCookie !== undefined) {
          assert.strictEqual(overriddenCookie.options?.secure, false)
          assert.strictEqual(overriddenCookie.options?.httpOnly, false)
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("clearCookie writes explicit expiry and max-age headers", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.none()),
          generateSessionId: Effect.succeed(HttpSession.SessionId("helper-clear")),
          cookie: {
            name: "session_token"
          }
        })

        const response = yield* HttpSession.clearCookie(HttpServerResponse.empty(), {
          path: "/auth",
          domain: "example.com"
        }).pipe(Effect.provideService(HttpSession.HttpSession, session))

        const cookie = Cookies.get(response.cookies, "session_token")
        assert.isTrue(cookie !== undefined)
        if (cookie !== undefined) {
          assert.strictEqual(cookie.value, "")
          assert.strictEqual(cookie.options?.path, "/auth")
          assert.strictEqual(cookie.options?.domain, "example.com")
          assert.strictEqual(cookie.options?.maxAge, 0)
          assert.strictEqual(cookie.options?.expires?.getTime(), 0)

          const header = Cookies.serializeCookie(cookie)
          assert.isTrue(header.includes("Max-Age=0"))
          assert.isTrue(header.includes("Expires=Thu, 01 Jan 1970 00:00:00 GMT"))
        }
      })
    ).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("never computes negative ttl for session writes", () =>
    Effect.scoped(
      Effect.gen(function*() {
        let current = 0
        const clock: Clock.Clock = {
          currentTimeMillisUnsafe: () => {
            current += 2
            return current
          },
          currentTimeMillis: Effect.sync(() => {
            current += 2
            return current
          }),
          currentTimeNanosUnsafe: () => {
            current += 2
            return BigInt(current) * 1_000_000n
          },
          currentTimeNanos: Effect.sync(() => {
            current += 2
            return BigInt(current) * 1_000_000n
          }),
          sleep: () => Effect.void
        }

        const persistence = Persistence.Persistence.of({
          make: ({ timeToLive }) =>
            Effect.succeed({
              get: () => Effect.succeed(undefined),
              getMany: () => Effect.succeed([]),
              set: (key, value) =>
                Effect.sync(() => {
                  const ttl = Duration.toMillis(
                    Duration.fromDurationInputUnsafe(timeToLive?.(value, key) ?? Duration.infinity)
                  )
                  assert.isTrue(ttl >= 0)
                }),
              setMany: (entries) =>
                Effect.sync(() => {
                  for (const [key, value] of entries) {
                    const ttl = Duration.toMillis(
                      Duration.fromDurationInputUnsafe(timeToLive?.(value, key) ?? Duration.infinity)
                    )
                    assert.isTrue(ttl >= 0)
                  }
                }),
              remove: () => Effect.void,
              clear: Effect.void
            })
        })

        const session = yield* HttpSession.make({
          getSessionId: Effect.succeed(Option.none()),
          expiresIn: Duration.millis(1),
          disableRefresh: true,
          generateSessionId: Effect.succeed(HttpSession.SessionId("ttl-bound"))
        }).pipe(
          Effect.provideService(Clock.Clock, clock),
          Effect.provideService(Persistence.Persistence, persistence)
        )

        yield* session.set(ValueKey, "value")
      })
    ))
})
