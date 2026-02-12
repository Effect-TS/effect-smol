/**
 * @since 4.0.0
 */
import type * as Brand from "../../Brand.ts"
import * as Data from "../../Data.ts"
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import { dual } from "../../Function.ts"
import { YieldableProto } from "../../internal/core.ts"
import * as Option from "../../Option.ts"
import * as PrimaryKey from "../../PrimaryKey.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schema from "../../Schema.ts"
import type { Scope } from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Persistable from "../persistence/Persistable.ts"
import * as Persistence from "../persistence/Persistence.ts"
import type { PersistenceError } from "../persistence/Persistence.ts"
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
  readonly id: SessionId
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
 * @category Storage
 */
export const make: <E, R>(
  options: {
    readonly getSessionId: Effect.Effect<Option.Option<SessionId>, E, R>
    readonly timeToLive?: Duration.DurationInput | undefined
    readonly generateSessionId?: Effect.Effect<SessionId> | undefined
  }
) => Effect.Effect<
  HttpSession["Service"],
  E,
  R | Persistence.Persistence | Scope
> = Effect.fnUntraced(function*<E, R>(options: {
  readonly getSessionId: Effect.Effect<Option.Option<SessionId>, E, R>
  readonly timeToLive?: Duration.DurationInput | undefined
  readonly generateSessionId?: Effect.Effect<SessionId> | undefined
}): Effect.fn.Return<HttpSession["Service"], E, R | Persistence.Persistence | Scope> {
  const persistence = yield* Persistence.Persistence
  const sessionId = yield* options.getSessionId.pipe(
    Effect.flatMap((o) =>
      Option.isNone(o) ? (options.generateSessionId ?? defaultGenerateSessionId) : Effect.succeed(o.value)
    )
  )
  const timeToLive = options.timeToLive ? Duration.fromDurationInputUnsafe(options.timeToLive) : Duration.minutes(30)
  const storage = yield* persistence.make({
    storeId: `session:${sessionId}`,
    timeToLive(_exit) {
      return timeToLive
    }
  })

  return HttpSession.of({
    id: sessionId,
    get: <S extends Schema.Top>(
      key: Key<S>
    ): Effect.Effect<Option.Option<S["Type"]>, HttpSessionError, S["DecodingServices"]> =>
      storage.get(key).pipe(
        Effect.map((exit) => {
          if (!exit || exit._tag === "Failure") {
            return Option.none()
          }
          return Option.some(exit.value)
        }),
        Effect.mapError((error) => new HttpSessionError(error))
      ),
    set: (key, value) =>
      storage.set(key, Exit.succeed(value)).pipe(
        Effect.mapError((error) => new HttpSessionError(error))
      ),
    remove: (key) =>
      storage.remove(key).pipe(
        Effect.mapError((error) => new HttpSessionError(error))
      ),
    clear: storage.clear.pipe(
      Effect.mapError((error) => new HttpSessionError(error))
    )
  })
})

const defaultGenerateSessionId = Effect.sync(() => SessionId(crypto.randomUUID()))

/**
 * @since 4.0.0
 * @category Response helpers
 */
export const setCookie: {
  (options?: {
    readonly name?: string | undefined
    readonly path?: string | undefined
    readonly domain?: string | undefined
    readonly secure?: boolean | undefined
    readonly httpOnly?: boolean | undefined
  }): (response: HttpServerResponse) => Effect.Effect<HttpServerResponse, never, HttpSession>
  (response: HttpServerResponse, options?: {
    readonly name?: string | undefined
    readonly path?: string | undefined
    readonly domain?: string | undefined
    readonly secure?: boolean | undefined
    readonly httpOnly?: boolean | undefined
  }): Effect.Effect<HttpServerResponse, never, HttpSession>
} = dual((args) => Response.isHttpServerResponse(args[0]), (response: HttpServerResponse, options?: {
  readonly name?: string | undefined
  readonly path?: string | undefined
  readonly domain?: string | undefined
  readonly secure?: boolean | undefined
  readonly httpOnly?: boolean | undefined
}): Effect.Effect<HttpServerResponse, never, HttpSession> =>
  HttpSession.useSync((session) =>
    Response.setCookieUnsafe(response, options?.name ?? "sid", Redacted.value(session.id), {
      path: options?.path,
      domain: options?.domain,
      secure: options?.secure ?? true,
      httpOnly: options?.httpOnly ?? true
    })
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
