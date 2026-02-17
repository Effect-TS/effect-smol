/**
 * @since 4.0.0
 */
import type * as Brand from "../../Brand.ts"
import { Clock } from "../../Clock.ts"
import * as Data from "../../Data.ts"
import * as DateTime from "../../DateTime.ts"
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import { identity } from "../../Function.ts"
import { YieldableProto } from "../../internal/core.ts"
import * as Option from "../../Option.ts"
import * as PrimaryKey from "../../PrimaryKey.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schema from "../../Schema.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Persistable from "../persistence/Persistable.ts"
import * as Persistence from "../persistence/Persistence.ts"
import type { PersistenceError } from "../persistence/Persistence.ts"
import * as Cookies from "./Cookies.ts"
import type { HttpServerResponse } from "./HttpServerResponse.ts"
import * as Response from "./HttpServerResponse.ts"

/**
 * @since 4.0.0
 * @category Key
 */
export type KeyTypeId = "~effect/http/HttpSession/Key"

/**
 * @since 4.0.0
 * @category Key
 */
export const KeyTypeId: KeyTypeId = "~effect/http/HttpSession/Key"

/**
 * @since 4.0.0
 * @category Key
 */
export interface Key<S extends Schema.Top>
  extends
    Persistable.Persistable<S, Schema.Never>,
    Effect.Yieldable<Key<S>, Option.Option<S["Type"]>, HttpSessionError, HttpSession | S["DecodingServices"]>
{
  readonly [KeyTypeId]: KeyTypeId
  readonly id: string

  readonly getOrFail: Effect.Effect<S["Type"], HttpSessionError, HttpSession | S["DecodingServices"]>
  readonly set: (value: S["Type"]) => Effect.Effect<void, HttpSessionError, HttpSession | S["EncodingServices"]>
  readonly remove: Effect.Effect<void, HttpSessionError, HttpSession>
}

/**
 * @since 4.0.0
 * @category Key
 * @example
 * ```ts
 * import { Effect, Option, Schema } from "effect"
 * import { HttpSession } from "effect/unstable/http"
 *
 * const UserId = HttpSession.key({
 *   id: "userId",
 *   schema: Schema.String
 * })
 *
 * const readUserId = Effect.gen(function*() {
 *   const maybeUserId = yield* UserId
 *   return Option.isNone(maybeUserId) ? "guest" : maybeUserId.value
 * })
 * ```
 */
export const key = <S extends Schema.Top>(options: {
  readonly id: string
  readonly schema: S
}): Key<S> =>
  Object.assign(Object.create(KeyProto), {
    id: options.id,
    [Persistable.symbol]: {
      success: options.schema,
      error: Schema.Never
    }
  })

const KeyProto: Omit<Key<Schema.Top>, "id" | "schema" | typeof Persistable.symbol> = {
  ...YieldableProto,
  [KeyTypeId]: KeyTypeId,
  asEffect(this: Key<Schema.Top>) {
    return HttpSession.use((session) => session.get(this))
  },
  get getOrFail() {
    const key = this as Key<Schema.Top>
    return Effect.flatMap(
      this.asEffect(),
      (o) => Option.isNone(o) ? Effect.fail(new HttpSessionError(new KeyNotFound({ key }))) : Effect.succeed(o.value)
    )
  },
  set(this: Key<Schema.Top>, value: any) {
    return HttpSession.use((session) => session.set(this, value))
  },
  get remove() {
    return HttpSession.use((session) => session.remove(this as any))
  },
  [PrimaryKey.symbol](this: Key<any>): string {
    return this.id
  }
}

/**
 * @since 4.0.0
 * @category Session ID
 */
export type SessionId = Brand.Branded<Redacted.Redacted, "effect/http/HttpSession/SessionId">

/**
 * @since 4.0.0
 * @category Session ID
 */
export const SessionId = (value: string): SessionId => Redacted.make(value) as SessionId

/**
 * @since 4.0.0
 * @category Storage
 */
export class HttpSession extends ServiceMap.Service<HttpSession, {
  readonly state: Effect.Effect<SessionState, HttpSessionError>
  readonly cookie: Effect.Effect<Cookies.Cookie>
  readonly rotate: Effect.Effect<void, HttpSessionError>
  readonly get: <S extends Schema.Top>(
    key: Key<S>
  ) => Effect.Effect<Option.Option<S["Type"]>, HttpSessionError, S["DecodingServices"]>
  readonly set: <S extends Schema.Top>(
    key: Key<S>,
    value: S["Type"]
  ) => Effect.Effect<void, HttpSessionError, S["EncodingServices"]>
  readonly remove: <S extends Schema.Top>(key: Key<S>) => Effect.Effect<void, HttpSessionError>
  readonly clear: Effect.Effect<void, HttpSessionError>
}>()("effect/http/HttpSession") {}

/**
 * @since 4.0.0
 * @category State
 */
export interface SessionState {
  readonly id: SessionId
  readonly metadata: SessionMeta
  readonly storage: Persistence.PersistenceStore
  readonly action: "none" | "set" | "clear"
}

/**
 * @since 4.0.0
 * @category State
 */
export class SessionMeta extends Schema.Class<SessionMeta>("effect/http/HttpSession/SessionMeta")({
  createdAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc,
  lastRefreshedAt: Schema.DateTimeUtc
}) {
  static key = key({
    id: "_meta",
    schema: SessionMeta
  })

  isExpired(now: DateTime.Utc): boolean {
    return DateTime.isLessThanOrEqualTo(this.expiresAt, now)
  }
}

/**
 * @since 4.0.0
 * @category Storage
 */
export interface MakeHttpSessionOptions<E = never, R = never> {
  readonly cookie?: {
    readonly name?: string | undefined
    readonly path?: string | undefined
    readonly domain?: string | undefined
    readonly secure?: boolean | undefined
    readonly httpOnly?: boolean | undefined
    readonly sameSite?: "lax" | "strict" | "none" | undefined
  } | undefined
  readonly getSessionId: Effect.Effect<Option.Option<SessionId>, E, R>
  readonly expiresIn?: Duration.DurationInput | undefined
  readonly updateAge?: Duration.DurationInput | undefined
  readonly disableRefresh?: boolean | undefined
  readonly generateSessionId?: Effect.Effect<SessionId> | undefined
}

/**
 * @since 4.0.0
 * @category Storage
 * @example
 * ```ts
 * import { Effect, Option } from "effect"
 * import { HttpSession } from "effect/unstable/http"
 * import { Persistence } from "effect/unstable/persistence"
 *
 * const session = HttpSession.make({
 *   getSessionId: Effect.succeed(Option.none())
 * }).pipe(
 *   Effect.provide(Persistence.layerMemory),
 *   Effect.scoped
 * )
 * ```
 */
export const make = Effect.fnUntraced(function*<E, R>(
  options: MakeHttpSessionOptions<E, R>
): Effect.fn.Return<
  HttpSession["Service"],
  E | HttpSessionError,
  R | Persistence.Persistence | Scope.Scope
> {
  const scope = yield* Scope.Scope
  const persistence = yield* Persistence.Persistence
  const clock = yield* Clock
  const expiresIn = Duration.fromDurationInputUnsafe(options.expiresIn ?? Duration.days(7))
  const updateAge = Duration.min(Duration.fromDurationInputUnsafe(options.updateAge ?? Duration.days(1)), expiresIn)
  const updateAgeMillis = Duration.toMillis(updateAge)
  const disableRefresh = options.disableRefresh ?? false
  const generateSessionId = options.generateSessionId ?? defaultGenerateSessionId
  const mapHttpSessionError = Effect.mapError(
    (error: PersistenceError | KeyNotFound | Schema.SchemaError) => new HttpSessionError(error)
  )

  const makeSessionMeta = (now: DateTime.Utc, createdAt = now): SessionMeta =>
    new SessionMeta({
      createdAt,
      expiresAt: DateTime.addDuration(now, expiresIn),
      lastRefreshedAt: now
    })

  const makeStorage = (sessionId: SessionId): Effect.Effect<Persistence.PersistenceStore> =>
    Effect.provideService(
      persistence.make({
        storeId: `session:${Redacted.value(sessionId)}`,
        timeToLive() {
          return Duration.millis(currentState.metadata.expiresAt.epochMillis - clock.currentTimeMillisUnsafe())
        }
      }),
      Scope.Scope,
      scope
    )

  const shouldRefresh = (metadata: SessionMeta, now: DateTime.Utc): boolean =>
    !disableRefresh && now.epochMillis - metadata.lastRefreshedAt.epochMillis >= updateAgeMillis

  const refreshMetadata = Effect.fnUntraced(function*(state: SessionState, now: DateTime.Utc) {
    const refreshedMetadata = makeSessionMeta(now, state.metadata.createdAt)
    yield* state.storage.set(SessionMeta.key, Exit.succeed(refreshedMetadata))
    return identity<SessionState>({ ...state, metadata: refreshedMetadata, action: "set" })
  }, Effect.catchIf(Schema.isSchemaError, Effect.die))

  const reconcileState = Effect.fnUntraced(function*(
    state: SessionState
  ): Effect.fn.Return<SessionState, PersistenceError> {
    const metadata = yield* state.storage.get(SessionMeta.key).pipe(
      Effect.catchTag("SchemaError", () => Effect.undefined)
    )
    if (!metadata || metadata._tag === "Failure") {
      return yield* freshState
    }
    const now = yield* DateTime.now
    if (metadata.value.isExpired(now)) {
      yield* state.storage.clear
      return yield* freshState
    }
    const currentState = identity<SessionState>({
      ...state,
      metadata: metadata.value
    })
    if (shouldRefresh(currentState.metadata, now)) {
      return yield* refreshMetadata(currentState, now)
    }
    return currentState
  })

  const freshState = Effect.gen(function*() {
    const id = yield* generateSessionId
    const now = yield* DateTime.now
    const metadata = makeSessionMeta(now)
    const state = identity<SessionState>({
      id,
      metadata,
      storage: yield* makeStorage(id),
      action: "set"
    })
    yield* state.storage.set(SessionMeta.key, Exit.succeed(state.metadata))
    return state
  }).pipe(Effect.catchIf(Schema.isSchemaError, Effect.die))

  const initialState = Effect.gen(function*() {
    const sessionId = yield* options.getSessionId.pipe(
      Effect.flatMap(Option.match({
        onNone: () => generateSessionId,
        onSome: Effect.succeed
      }))
    )
    const now = yield* DateTime.now
    const metadata = makeSessionMeta(now)
    return identity<SessionState>({
      id: sessionId,
      metadata,
      storage: yield* makeStorage(sessionId),
      action: "none"
    })
  })

  let currentState = yield* initialState
  currentState = yield* reconcileState(currentState).pipe(mapHttpSessionError)

  const withStateLock = Effect.makeSemaphoreUnsafe(1).withPermit

  const withStorage = <A, E2, R2>(
    f: (storage: Persistence.PersistenceStore) => Effect.Effect<A, E2, R2>
  ) => Effect.flatMap(ensureState, (state) => f(state.storage))

  const ensureState = withStateLock(Effect.gen(function*() {
    const now = yield* DateTime.now
    if (!shouldRefresh(currentState.metadata, now)) {
      return currentState
    }
    currentState = yield* refreshMetadata(currentState, now)
    return currentState
  }))

  const rotate = withStateLock(Effect.gen(function*() {
    const previousState = currentState
    const nextState = yield* freshState
    currentState = nextState
    if (Redacted.value(previousState.id) !== Redacted.value(nextState.id)) {
      yield* Effect.ignore(previousState.storage.clear)
    }
  }))

  return HttpSession.of({
    state: ensureState.pipe(mapHttpSessionError),
    cookie: Effect.sync(() =>
      Cookies.makeCookieUnsafe(options.cookie?.name ?? "sid", Redacted.value(currentState.id), {
        ...options.cookie,
        expires: new Date(currentState.metadata.expiresAt.epochMillis),
        secure: options.cookie?.secure ?? true,
        httpOnly: options.cookie?.httpOnly ?? true
      })
    ),
    rotate: rotate.pipe(mapHttpSessionError),
    get: Effect.fnUntraced(function*<S extends Schema.Top>(
      key: Key<S>
    ) {
      const state = yield* ensureState
      const exit = yield* state.storage.get(key)
      if (!exit || exit._tag === "Failure") {
        return Option.none()
      }
      return Option.some(exit.value)
    }, mapHttpSessionError),
    set: (key, value) => withStorage((storage) => storage.set(key, Exit.succeed(value))).pipe(mapHttpSessionError),
    remove: (key) => withStorage((storage) => storage.remove(key)).pipe(mapHttpSessionError),
    clear: withStorage((storage) => storage.clear).pipe(
      Effect.onExit((_) => {
        currentState = {
          ...currentState,
          action: "clear"
        }
      }),
      mapHttpSessionError
    )
  })
})

const defaultGenerateSessionId = Effect.sync(() => SessionId(crypto.randomUUID()))

/**
 * @since 4.0.0
 * @category Response helpers
 */
export const setCookie = (
  self: HttpSession["Service"],
  response: HttpServerResponse
): Effect.Effect<HttpServerResponse> =>
  Effect.map(
    self.cookie,
    (cookie) => Response.updateCookies(response, Cookies.setCookie(cookie))
  )

/**
 * @since 4.0.0
 * @category Response helpers
 */
export const clearCookie = (
  self: HttpSession["Service"],
  response: HttpServerResponse
): Effect.Effect<HttpServerResponse> =>
  Effect.map(self.cookie, (cookie) =>
    Response.updateCookies(
      response,
      Cookies.setCookie(
        Cookies.makeCookieUnsafe(cookie.name, "", {
          ...cookie.options,
          maxAge: 0,
          expires: new Date(0)
        })
      )
    ))

/**
 * @since 4.0.0
 * @category Errors
 */
export type ErrorTypeId = "~effect/http/HttpSession/Error"

/**
 * @since 4.0.0
 * @category Errors
 */
export const ErrorTypeId: ErrorTypeId = "~effect/http/HttpSession/Error"

/**
 * @since 4.0.0
 * @category Errors
 */
export class HttpSessionError extends Data.TaggedError("HttpSessionError")<{
  readonly reason: PersistenceError | KeyNotFound | Schema.SchemaError
}> {
  constructor(reason: PersistenceError | KeyNotFound | Schema.SchemaError) {
    super({ reason, cause: reason } as any)
  }

  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: ErrorTypeId = ErrorTypeId

  /**
   * @since 4.0.0
   */
  override readonly message: string = this.reason.message
}

/**
 * @since 4.0.0
 * @category Errors
 */
export class KeyNotFound extends Data.TaggedError("KeyNotFound")<{
  readonly key: Key<Schema.Top>
}> {
  /**
   * @since 4.0.0
   */
  override readonly message = `Session.Key with id "${this.key.id}" not found`
}
