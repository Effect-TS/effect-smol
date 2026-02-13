/**
 * @since 4.0.0
 */
import type * as Brand from "../../Brand.ts"
import * as Data from "../../Data.ts"
import * as DateTime from "../../DateTime.ts"
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import { identity } from "../../Function.ts"
import { YieldableProto } from "../../internal/core.ts"
import * as MutableRef from "../../MutableRef.ts"
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
    Effect.Yieldable<Key<S>, Option.Option<S["Type"]>, HttpSessionError, HttpSession | S["DecodingServices"]>,
    PrimaryKey.PrimaryKey
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
  readonly id: MutableRef.MutableRef<SessionId>
  readonly state: Effect.Effect<SessionState, HttpSessionError>
  readonly cookie: Effect.Effect<Cookies.Cookie>
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
    id: "meta",
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
  } | undefined
  readonly getSessionId: Effect.Effect<Option.Option<SessionId>, E, R>
  readonly timeToLive?: Duration.DurationInput | undefined
  readonly expiresIn?: Duration.DurationInput | undefined
  readonly updateAge?: Duration.DurationInput | undefined
  readonly disableRefresh?: boolean | undefined
  readonly generateSessionId?: Effect.Effect<SessionId> | undefined
}

interface InternalSessionState {
  id: SessionId
  metadata: SessionMeta
  storage: Persistence.PersistenceStore
}

/**
 * @since 4.0.0
 * @category Storage
 */
export const make = Effect.fnUntraced(function*<E, R>(
  options: MakeHttpSessionOptions<E, R>
): Effect.fn.Return<
  HttpSession["Service"],
  E,
  R | Persistence.Persistence | Scope.Scope
> {
  const scope = yield* Scope.Scope
  const persistence = yield* Persistence.Persistence
  const clock = yield* Effect.clockWith((clock) => Effect.succeed(clock))
  const expiresIn = Duration.fromDurationInputUnsafe(options.expiresIn ?? options.timeToLive ?? Duration.days(7))
  const updateAge = Duration.min(Duration.fromDurationInputUnsafe(options.updateAge ?? Duration.days(1)), expiresIn)
  const updateAgeMillis = Duration.toMillis(updateAge)
  const disableRefresh = options.disableRefresh ?? false
  const generateSessionId = options.generateSessionId ?? defaultGenerateSessionId

  const makeSessionMeta = (now: DateTime.Utc, createdAt = now) =>
    new SessionMeta({
      createdAt,
      expiresAt: DateTime.addDuration(now, expiresIn),
      lastRefreshedAt: now
    })

  const makeStorage = (state: Pick<InternalSessionState, "id" | "metadata">) =>
    Effect.provideService(
      persistence.make({
        storeId: `session:${Redacted.value(state.id)}`,
        timeToLive() {
          return Duration.millis(state.metadata.expiresAt.epochMillis - clock.currentTimeMillisUnsafe())
        }
      }),
      Scope.Scope,
      scope
    )

  const shouldRefresh = (metadata: SessionMeta, now: DateTime.Utc): boolean =>
    !disableRefresh && now.epochMillis - metadata.lastRefreshedAt.epochMillis >= updateAgeMillis

  const refreshMetadata = (state: InternalSessionState, now: DateTime.Utc) =>
    Effect.gen(function*() {
      const previousMetadata = state.metadata
      const refreshedMetadata = makeSessionMeta(now, state.metadata.createdAt)
      state.metadata = refreshedMetadata
      const writeResult = yield* Effect.exit(state.storage.set(SessionMeta.key, Exit.succeed(refreshedMetadata)))
      if (Exit.isFailure(writeResult)) {
        state.metadata = previousMetadata
        return yield* writeResult
      }
    }).pipe(Effect.catchIf(Schema.isSchemaError, Effect.die))

  const reconcileState = (state: InternalSessionState): Effect.Effect<InternalSessionState, PersistenceError> =>
    Effect.gen(function*() {
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
      state.metadata = metadata.value
      if (shouldRefresh(state.metadata, now)) {
        yield* refreshMetadata(state, now)
      }
      return state
    })

  const freshState = Effect.gen(function*() {
    const id = yield* generateSessionId
    const now = yield* DateTime.now
    const state = identity<InternalSessionState>({
      id,
      metadata: makeSessionMeta(now),
      storage: undefined as any
    })
    state.storage = yield* makeStorage(state)
    yield* state.storage.set(SessionMeta.key, Exit.succeed(state.metadata))
    return state
  }).pipe(Effect.catchIf(Schema.isSchemaError, Effect.die))

  const initialState = Effect.gen(function*() {
    const sessionId = yield* options.getSessionId.pipe(
      Effect.flatMap((sessionId) => Option.isSome(sessionId) ? Effect.succeed(sessionId.value) : generateSessionId)
    )
    const now = yield* DateTime.now
    const state = identity<InternalSessionState>({
      id: sessionId,
      metadata: makeSessionMeta(now),
      storage: undefined as any
    })
    state.storage = yield* makeStorage(state)
    return yield* reconcileState(state)
  })

  const initial = yield* initialState.pipe(
    // TODO: surface persistence errors instead of dying
    Effect.orDie
  )

  const state = MutableRef.make(initial)
  const id = MutableRef.make(initial.id)

  const ensureState = Effect.gen(function*() {
    const currentState = state.current
    const nextState = yield* reconcileState(currentState)
    if (nextState !== currentState) {
      state.current = nextState
      id.current = nextState.id
    }
    return state.current
  }).pipe(Effect.makeSemaphoreUnsafe(1).withPermit)

  return HttpSession.of({
    id,
    state: ensureState.pipe(
      Effect.mapError((error) => new HttpSessionError(error))
    ),
    cookie: Effect.map(
      Effect.sync(() => state.current),
      (state) =>
        Cookies.makeCookieUnsafe(options.cookie?.name ?? "sid", Redacted.value(state.id), {
          ...options.cookie,
          expires: new Date(state.metadata.expiresAt.epochMillis),
          secure: options.cookie?.secure ?? true,
          httpOnly: options.cookie?.httpOnly ?? true
        })
    ),
    get: <S extends Schema.Top>(
      key: Key<S>
    ): Effect.Effect<Option.Option<S["Type"]>, HttpSessionError, S["DecodingServices"]> =>
      Effect.gen(function*() {
        const state = yield* ensureState
        const exit = yield* state.storage.get(key)
        if (!exit || exit._tag === "Failure") {
          return Option.none()
        }
        return Option.some(exit.value)
      }).pipe(
        Effect.mapError((error) => new HttpSessionError(error))
      ),
    set: (key, value) =>
      Effect.flatMap(
        ensureState,
        (state) => state.storage.set(key, Exit.succeed(value))
      ).pipe(
        Effect.mapError((error) => new HttpSessionError(error))
      ),
    remove: (key) =>
      Effect.flatMap(
        ensureState,
        (state) => state.storage.remove(key)
      ).pipe(
        Effect.mapError((error) => new HttpSessionError(error))
      ),
    clear: Effect.flatMap(
      ensureState,
      (state) => state.storage.clear
    ).pipe(
      Effect.mapError((error) => new HttpSessionError(error))
    )
  })
})

const defaultGenerateSessionId = Effect.sync(() => SessionId(crypto.randomUUID()))

/**
 * @since 4.0.0
 * @category Response helpers
 */
export const setCookie = (response: HttpServerResponse): Effect.Effect<HttpServerResponse, never, HttpSession> =>
  HttpSession.use((session) =>
    Effect.map(
      session.cookie,
      (cookie) => Response.updateCookies(response, Cookies.setCookie(cookie))
    )
  )

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
