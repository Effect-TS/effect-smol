import { assert, describe, it } from "@effect/vitest"
import { Clock, DateTime, Duration, Effect, Exit, Option, Redacted, Schema } from "effect"
import { TestClock } from "effect/testing"
import { Cookies, HttpRouter, HttpServerRequest, HttpServerResponse, HttpSession } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi"
import { Persistence } from "effect/unstable/persistence"

const CorruptSessionMetaKey = HttpSession.key({
  id: HttpSession.SessionMeta.key.id,
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

class SessionMiddleware extends HttpApiMiddleware.HttpSession<SessionMiddleware>()("SessionMiddleware", {
  security: HttpApiSecurity.apiKey({ key: "session_token", in: "cookie" })
}) {}

describe("HttpSession", () => {
  it.effect("regenerates session id when metadata is missing", () =>
    Effect.gen(function*() {
      const previousId = HttpSession.SessionId("previous")
      const newId = HttpSession.SessionId("new")

      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.some(previousId)),
        generateSessionId: Effect.succeed(newId)
      })

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(newId))

      const persistence = yield* Persistence.Persistence
      const store = yield* persistence.make({ storeId: toStoreId(newId) })
      const metadata = yield* store.get(HttpSession.SessionMeta.key)
      assert.isTrue(metadata !== undefined && metadata._tag === "Success")
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("regenerates session id when metadata is corrupt", () =>
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

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(newId))
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("regenerates session id when metadata is expired", () =>
    Effect.gen(function*() {
      const previousId = HttpSession.SessionId("previous")
      const newId = HttpSession.SessionId("new")
      const now = yield* DateTime.now
      const persistence = yield* Persistence.Persistence
      const store = yield* persistence.make({ storeId: toStoreId(previousId) })

      yield* store.set(
        HttpSession.SessionMeta.key,
        Exit.succeed(
          new HttpSession.SessionMeta({
            createdAt: DateTime.subtract(now, { seconds: 1 }),
            expiresAt: DateTime.subtract(now, { millis: 1 }),
            lastRefreshedAt: DateTime.subtract(now, { seconds: 1 })
          })
        )
      )

      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.some(previousId)),
        generateSessionId: Effect.succeed(newId)
      })

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(newId))
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("revalidates metadata before write operations", () =>
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
      yield* firstStore.remove(HttpSession.SessionMeta.key)

      yield* session.set(ValueKey, "value")

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(secondId))

      const firstValue = yield* firstStore.get(ValueKey)
      assert.strictEqual(firstValue, undefined)

      const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
      const secondValue = yield* (yield* secondStore.get(ValueKey))!
      assert.strictEqual(secondValue, "value")
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("revalidates metadata before read operations", () =>
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
      yield* firstStore.remove(HttpSession.SessionMeta.key)

      const value = yield* session.get(ValueKey)
      assert.isTrue(Option.isNone(value))
      const state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(secondId))
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("revalidates metadata before remove operations", () =>
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
      yield* firstStore.remove(HttpSession.SessionMeta.key)

      yield* session.remove(ValueKey)

      const state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(secondId))

      const firstValue = yield* (yield* firstStore.get(ValueKey))!
      assert.strictEqual(firstValue, "stale")

      const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
      const secondValue = yield* secondStore.get(ValueKey)
      assert.strictEqual(secondValue, undefined)
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("revalidates metadata before clear operations", () =>
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
      yield* firstStore.remove(HttpSession.SessionMeta.key)

      yield* session.clear

      const state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(secondId))

      const firstValue = yield* (yield* firstStore.get(ValueKey))!
      assert.strictEqual(firstValue, "stale")

      const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
      const secondMeta = yield* secondStore.get(HttpSession.SessionMeta.key)
      assert.strictEqual(secondMeta, undefined)
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("rotates session id and keeps the resolved service usable", () =>
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

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(secondId))

      const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })

      yield* session.set(ValueKey, "stale")
      yield* session.rotate

      state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(thirdId))

      const secondMeta = yield* secondStore.get(HttpSession.SessionMeta.key)
      assert.strictEqual(secondMeta, undefined)
      const secondValue = yield* secondStore.get(ValueKey)
      assert.strictEqual(secondValue, undefined)

      yield* session.set(ValueKey, "fresh")

      const thirdStore = yield* persistence.make({ storeId: toStoreId(thirdId) })
      yield* (yield* thirdStore.get(HttpSession.SessionMeta.key))!

      const thirdValue = yield* (yield* thirdStore.get(ValueKey))!
      assert.strictEqual(thirdValue, "fresh")
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("rotates even when clearing the previous store fails", () =>
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

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(secondId))

      yield* session.set(ValueKey, "stale")
      yield* session.rotate

      state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(thirdId))

      const secondValue = yield* (yield* secondStore.get(ValueKey))!
      assert.strictEqual(secondValue, "stale")

      yield* session.set(ValueKey, "fresh")

      const thirdStore = yield* basePersistence.make({ storeId: toStoreId(thirdId) })
      yield* (yield* thirdStore.get(HttpSession.SessionMeta.key))!
      const thirdValue = yield* (yield* thirdStore.get(ValueKey))!
      assert.strictEqual(thirdValue, "fresh")
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("keeps state consistent when rotate generates the current id", () =>
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

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(firstId))

      yield* session.set(ValueKey, "stale")
      yield* session.rotate

      state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(firstId))

      yield* session.set(ValueKey, "fresh")

      state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(firstId))

      const firstMeta = yield* firstStore.get(HttpSession.SessionMeta.key)
      assert.isTrue(firstMeta !== undefined && firstMeta._tag === "Success")

      const firstValue = yield* (yield* firstStore.get(ValueKey))!
      assert.strictEqual(firstValue, "fresh")

      const secondStore = yield* persistence.make({ storeId: toStoreId(secondId) })
      const secondMeta = yield* secondStore.get(HttpSession.SessionMeta.key)
      assert.strictEqual(secondMeta, undefined)
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("regenerates session id when middleware cookie is missing", () =>
    Effect.gen(function*() {
      const middleware = yield* SessionMiddleware
      const response = yield* middleware(Effect.succeed(HttpServerResponse.empty()), {} as any).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(new Request("http://localhost/"))
        ),
        Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
        Effect.provideService(HttpRouter.RouteContext, {
          params: {},
          route: {} as any
        })
      )

      const cookie = Cookies.get(response.cookies, "session_token")
      assert.isTrue(cookie !== undefined)
      if (cookie !== undefined) {
        assert.strictEqual(cookie.value, "generated-missing")
      }
    }).pipe(
      Effect.provide(HttpApiBuilder.middlewareHttpSession(SessionMiddleware, {
        generateSessionId: Effect.succeed(HttpSession.SessionId("generated-missing"))
      })),
      Effect.provide(Persistence.layerMemory)
    ))

  it.effect("regenerates session id when middleware cookie is invalid", () =>
    Effect.gen(function*() {
      const middleware = yield* SessionMiddleware
      const response = yield* middleware(Effect.succeed(HttpServerResponse.empty()), {} as any).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(
            new Request("http://localhost/", {
              headers: {
                cookie: "session_token=invalid-cookie"
              }
            })
          )
        ),
        Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
        Effect.provideService(HttpRouter.RouteContext, {
          params: {},
          route: {} as any
        })
      )

      const cookie = Cookies.get(response.cookies, "session_token")
      assert.isTrue(cookie !== undefined)
      if (cookie !== undefined) {
        assert.strictEqual(cookie.value, "generated-invalid")
      }
    }).pipe(
      Effect.provide(HttpApiBuilder.middlewareHttpSession(SessionMiddleware, {
        generateSessionId: Effect.succeed(HttpSession.SessionId("generated-invalid"))
      })),
      Effect.provide(Persistence.layerMemory)
    ))

  it.effect("regenerates session id when middleware cookie points to expired metadata", () =>
    Effect.gen(function*() {
      const staleId = HttpSession.SessionId("expired-cookie")
      const freshId = HttpSession.SessionId("fresh-cookie")
      const persistence = yield* Persistence.Persistence
      const staleStore = yield* persistence.make({ storeId: toStoreId(staleId) })
      const now = yield* DateTime.now

      yield* staleStore.set(
        HttpSession.SessionMeta.key,
        Exit.succeed(
          new HttpSession.SessionMeta({
            createdAt: DateTime.subtract(now, { minutes: 1 }),
            expiresAt: DateTime.subtract(now, { millis: 1 }),
            lastRefreshedAt: DateTime.subtract(now, { minutes: 1 })
          })
        )
      )
      yield* staleStore.set(ValueKey, Exit.succeed("stale"))

      const middleware = yield* SessionMiddleware
      const response = yield* middleware(Effect.succeed(HttpServerResponse.empty()), {} as any).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(
            new Request("http://localhost/", {
              headers: {
                cookie: `session_token=${Redacted.value(staleId)}`
              }
            })
          )
        ),
        Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
        Effect.provideService(HttpRouter.RouteContext, {
          params: {},
          route: {} as any
        })
      )

      const cookie = Cookies.get(response.cookies, "session_token")
      assert.isTrue(cookie !== undefined)
      if (cookie !== undefined) {
        assert.strictEqual(cookie.value, Redacted.value(freshId))
      }

      const staleMetadata = yield* staleStore.get(HttpSession.SessionMeta.key)
      assert.strictEqual(staleMetadata, undefined)
      const staleValue = yield* staleStore.get(ValueKey)
      assert.strictEqual(staleValue, undefined)
    }).pipe(
      Effect.provide(HttpApiBuilder.middlewareHttpSession(SessionMiddleware, {
        generateSessionId: Effect.succeed(HttpSession.SessionId("fresh-cookie"))
      })),
      Effect.provide(Persistence.layerMemory)
    ))

  it.effect("refreshes metadata at the updateAge threshold boundary", () =>
    Effect.gen(function*() {
      const sessionId = HttpSession.SessionId("refresh")
      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.some(sessionId)),
        expiresIn: Duration.minutes(10),
        updateAge: Duration.minutes(2)
      })

      let state = yield* session.state
      const persistence = yield* Persistence.Persistence
      const store = yield* persistence.make({ storeId: toStoreId(state.id) })
      const before = yield* (yield* store.get(HttpSession.SessionMeta.key))!

      yield* TestClock.adjust(Duration.millis(Duration.toMillis(Duration.minutes(2)) - 1))
      yield* session.state

      const beforeBoundary = yield* (yield* store.get(HttpSession.SessionMeta.key))!
      assert.strictEqual(beforeBoundary.lastRefreshedAt.epochMillis, before.lastRefreshedAt.epochMillis)
      assert.strictEqual(beforeBoundary.expiresAt.epochMillis, before.expiresAt.epochMillis)

      yield* TestClock.adjust(Duration.millis(1))
      yield* session.state

      const atBoundary = yield* (yield* store.get(HttpSession.SessionMeta.key))!
      assert.isTrue(atBoundary.lastRefreshedAt.epochMillis > before.lastRefreshedAt.epochMillis)
      assert.isTrue(atBoundary.expiresAt.epochMillis > before.expiresAt.epochMillis)
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("does not refresh metadata when refresh is disabled", () =>
    Effect.gen(function*() {
      const sessionId = HttpSession.SessionId("no-refresh")
      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.some(sessionId)),
        expiresIn: Duration.minutes(10),
        updateAge: Duration.minutes(1),
        disableRefresh: true
      })

      let state = yield* session.state
      const persistence = yield* Persistence.Persistence
      const store = yield* persistence.make({ storeId: toStoreId(state.id) })
      const before = yield* (yield* store.get(HttpSession.SessionMeta.key))!

      yield* TestClock.adjust(Duration.minutes(5))
      yield* session.state

      const after = yield* (yield* store.get(HttpSession.SessionMeta.key))!
      assert.strictEqual(after.lastRefreshedAt.epochMillis, before.lastRefreshedAt.epochMillis)
      assert.strictEqual(after.expiresAt.epochMillis, before.expiresAt.epochMillis)
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("clamps updateAge to expiresIn", () =>
    Effect.gen(function*() {
      const sessionId = HttpSession.SessionId("clamp")
      const persistence = yield* Persistence.Persistence
      const now = yield* DateTime.now
      const previousLastRefreshedAt = DateTime.subtract(now, { minutes: 2 })
      const store = yield* persistence.make({ storeId: toStoreId(sessionId) })

      yield* store.set(
        HttpSession.SessionMeta.key,
        Exit.succeed(
          new HttpSession.SessionMeta({
            createdAt: DateTime.subtract(now, { minutes: 10 }),
            expiresAt: DateTime.add(now, { minutes: 10 }),
            lastRefreshedAt: previousLastRefreshedAt
          })
        )
      )

      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.some(sessionId)),
        expiresIn: Duration.minutes(1),
        updateAge: Duration.minutes(5)
      })

      let state = yield* session.state
      assert.strictEqual(Redacted.value(state.id), Redacted.value(sessionId))

      const after = yield* (yield* store.get(HttpSession.SessionMeta.key))!
      assert.isTrue(after.lastRefreshedAt.epochMillis > previousLastRefreshedAt.epochMillis)
      assert.isTrue(after.expiresAt.epochMillis <= now.epochMillis + Duration.toMillis(Duration.minutes(2)))
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("bounds data key ttl to metadata expiration horizon", () =>
    Effect.gen(function*() {
      const sessionId = HttpSession.SessionId("ttl")
      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.some(sessionId)),
        expiresIn: Duration.minutes(2),
        disableRefresh: true
      })

      yield* session.set(ValueKey, "value")

      let state = yield* session.state
      const persistence = yield* Persistence.Persistence
      const store = yield* persistence.make({ storeId: toStoreId(state.id) })
      const before = yield* store.get(ValueKey)
      assert.isTrue(before !== undefined && before._tag === "Success")

      yield* TestClock.adjust(Duration.minutes(2))

      const after = yield* store.get(ValueKey)
      assert.strictEqual(after, undefined)
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("clearCookie writes explicit expiry and max-age headers", () =>
    Effect.gen(function*() {
      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.none()),
        generateSessionId: Effect.succeed(HttpSession.SessionId("helper-clear")),
        cookie: {
          name: "session_token"
        }
      })

      const response = yield* HttpSession.clearCookie(HttpServerResponse.empty()).pipe(
        Effect.provideService(HttpSession.HttpSession, session)
      )

      const cookie = Cookies.get(response.cookies, "session_token")
      assert.isTrue(cookie !== undefined)
      if (cookie !== undefined) {
        assert.strictEqual(cookie.value, "")
        assert.strictEqual(cookie.options?.maxAge, 0)
        assert.strictEqual(cookie.options?.expires?.getTime(), 0)

        const header = Cookies.serializeCookie(cookie)
        assert.isTrue(header.includes("Max-Age=0"))
        assert.isTrue(header.includes("Expires=Thu, 01 Jan 1970 00:00:00 GMT"))
      }
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("clearCookie keeps path and domain for cookie matching", () =>
    Effect.gen(function*() {
      const session = yield* HttpSession.make({
        getSessionId: Effect.succeed(Option.none()),
        generateSessionId: Effect.succeed(HttpSession.SessionId("helper-clear-match")),
        cookie: {
          name: "session_token",
          path: "/app",
          domain: "example.com"
        }
      })

      const response = yield* HttpSession.clearCookie(HttpServerResponse.empty()).pipe(
        Effect.provideService(HttpSession.HttpSession, session)
      )

      const cookie = Cookies.get(response.cookies, "session_token")
      assert.isTrue(cookie !== undefined)
      if (cookie !== undefined) {
        assert.strictEqual(cookie.options?.path, "/app")
        assert.strictEqual(cookie.options?.domain, "example.com")

        const header = Cookies.serializeCookie(cookie)
        assert.isTrue(header.includes("Path=/app"))
        assert.isTrue(header.includes("Domain=example.com"))
      }
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("securityMakeSession decodes session id from cookie api key", () =>
    Effect.gen(function*() {
      const queryId = HttpSession.SessionId("query-security")
      const headerId = HttpSession.SessionId("header-security")
      const cookieId = HttpSession.SessionId("cookie-security")
      const generatedId = HttpSession.SessionId("generated-security")
      const now = yield* DateTime.now
      const persistence = yield* Persistence.Persistence

      const setMetadata = (sessionId: HttpSession.SessionId) =>
        Effect.flatMap(
          persistence.make({ storeId: toStoreId(sessionId) }),
          (store) =>
            store.set(
              HttpSession.SessionMeta.key,
              Exit.succeed(
                new HttpSession.SessionMeta({
                  createdAt: DateTime.subtract(now, { minutes: 1 }),
                  expiresAt: DateTime.add(now, { minutes: 10 }),
                  lastRefreshedAt: DateTime.subtract(now, { minutes: 1 })
                })
              )
            )
        )

      yield* setMetadata(queryId)
      yield* setMetadata(headerId)
      yield* setMetadata(cookieId)

      const makeSession = (request: Request, searchParams: any) =>
        HttpApiBuilder.securityMakeSession(SessionMiddleware.security, {
          generateSessionId: Effect.succeed(generatedId)
        }).pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
          Effect.provideService(HttpServerRequest.ParsedSearchParams, searchParams)
        )

      const fromHeaderOrQuery = yield* makeSession(
        new Request(`http://localhost/?session_token=${Redacted.value(queryId)}`, {
          headers: {
            session_token: Redacted.value(headerId)
          }
        }),
        {
          session_token: Redacted.value(queryId)
        }
      )
      const fromHeaderOrQueryState = yield* fromHeaderOrQuery.state
      assert.strictEqual(Redacted.value(fromHeaderOrQueryState.id), Redacted.value(generatedId))

      const fromCookie = yield* makeSession(
        new Request(`http://localhost/?session_token=${Redacted.value(queryId)}`, {
          headers: {
            session_token: Redacted.value(headerId),
            cookie: `session_token=${Redacted.value(cookieId)}`
          }
        }),
        {
          session_token: Redacted.value(queryId)
        }
      )
      const fromCookieState = yield* fromCookie.state
      assert.strictEqual(Redacted.value(fromCookieState.id), Redacted.value(cookieId))
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("session middleware security is ApiKey in cookie mode", () =>
    Effect.sync(() => {
      assert.strictEqual(SessionMiddleware.security._tag, "ApiKey")
      assert.strictEqual(SessionMiddleware.security.in, "cookie")
      assert.strictEqual(SessionMiddleware.security.key, "session_token")
    }))

  it.effect("middleware refreshes cookie when metadata refreshes without id changes", () =>
    Effect.gen(function*() {
      const sessionId = HttpSession.SessionId("middleware-refresh")
      const middleware = yield* SessionMiddleware

      const run = (cookie: string) =>
        middleware(Effect.succeed(HttpServerResponse.empty()), {} as any).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(
              new Request("http://localhost/", {
                headers: {
                  cookie: `session_token=${cookie}`
                }
              })
            )
          ),
          Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
          Effect.provideService(HttpRouter.RouteContext, {
            params: {},
            route: {} as any
          })
        )

      const first = yield* run("stale")
      const firstCookie = Cookies.get(first.cookies, "session_token")
      assert.isTrue(firstCookie !== undefined)
      if (firstCookie !== undefined) {
        assert.strictEqual(firstCookie.value, Redacted.value(sessionId))
      }

      yield* TestClock.adjust(Duration.minutes(2))

      const second = yield* run(Redacted.value(sessionId))
      const secondCookie = Cookies.get(second.cookies, "session_token")
      assert.isTrue(secondCookie !== undefined)
      if (secondCookie !== undefined) {
        assert.strictEqual(secondCookie.value, Redacted.value(sessionId))
      }
    }).pipe(
      Effect.provide(HttpApiBuilder.middlewareHttpSession(SessionMiddleware, {
        generateSessionId: Effect.succeed(HttpSession.SessionId("middleware-refresh")),
        expiresIn: Duration.minutes(10),
        updateAge: Duration.minutes(2)
      })),
      Effect.provide(Persistence.layerMemory)
    ))

  it.effect("middleware sets refreshed cookie when threshold is crossed during handler", () =>
    Effect.gen(function*() {
      const sessionId = HttpSession.SessionId("middleware-refresh-during-handler")
      const middleware = yield* SessionMiddleware

      const run = (cookie: string, refreshDuringHandler: boolean) =>
        middleware(
          Effect.gen(function*() {
            if (refreshDuringHandler) {
              yield* TestClock.adjust(Duration.minutes(1))
            }
            return HttpServerResponse.empty()
          }),
          {} as any
        ).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(
              new Request("http://localhost/", {
                headers: {
                  cookie: `session_token=${cookie}`
                }
              })
            )
          ),
          Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
          Effect.provideService(HttpRouter.RouteContext, {
            params: {},
            route: {} as any
          })
        )

      const first = yield* run("stale", false)
      const firstCookie = Cookies.get(first.cookies, "session_token")
      assert.isTrue(firstCookie !== undefined)
      if (firstCookie !== undefined) {
        assert.strictEqual(firstCookie.value, Redacted.value(sessionId))
      }

      const second = yield* run(Redacted.value(sessionId), true)
      const secondCookie = Cookies.get(second.cookies, "session_token")
      assert.isTrue(secondCookie !== undefined)
      if (secondCookie !== undefined) {
        assert.strictEqual(secondCookie.value, Redacted.value(sessionId))
      }
    }).pipe(
      Effect.provide(HttpApiBuilder.middlewareHttpSession(SessionMiddleware, {
        generateSessionId: Effect.succeed(HttpSession.SessionId("middleware-refresh-during-handler")),
        expiresIn: Duration.minutes(10),
        updateAge: Duration.minutes(1)
      })),
      Effect.provide(Persistence.layerMemory)
    ))

  it.effect("middleware clears cookie when clear fails but request handles the error", () =>
    Effect.gen(function*() {
      const sessionId = HttpSession.SessionId("middleware-clear")
      const basePersistence = yield* Persistence.Persistence
      const wrappedPersistence = Persistence.Persistence.of({
        make: (options) =>
          Effect.map(
            basePersistence.make(options),
            (store) =>
              options.storeId === toStoreId(sessionId)
                ? {
                  ...store,
                  clear: Effect.fail(new Persistence.PersistenceError({ message: "clear failed" }))
                }
                : store
          )
      })

      const response = yield* SessionMiddleware.use((middleware) =>
        middleware(
          Effect.gen(function*() {
            const session = yield* HttpSession.HttpSession
            yield* Effect.ignore(session.clear)
            return HttpServerResponse.empty()
          }) as any,
          {} as any
        )
      ).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(
            new Request("http://localhost/", {
              headers: {
                cookie: `session_token=${Redacted.value(sessionId)}`
              }
            })
          )
        ),
        Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
        Effect.provideService(HttpRouter.RouteContext, {
          params: {},
          route: {} as any
        }),
        Effect.provide(HttpApiBuilder.middlewareHttpSession(SessionMiddleware, {
          generateSessionId: Effect.succeed(sessionId)
        })),
        Effect.provideService(Persistence.Persistence, wrappedPersistence)
      )

      const cookie = Cookies.get(response.cookies, "session_token")
      assert.isTrue(cookie !== undefined)
      if (cookie !== undefined) {
        assert.strictEqual(cookie.value, "")
        assert.strictEqual(cookie.options?.maxAge, 0)
        assert.strictEqual(cookie.options?.expires?.getTime(), 0)
      }
    }).pipe(Effect.provide(Persistence.layerMemory)))

  it.effect("never computes negative ttl for session writes", () =>
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
            get: () => Effect.undefined,
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
    }))
})
