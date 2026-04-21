/**
 * @since 1.0.0
 */
import { PGlite, type PGliteInterface, type PGliteOptions } from "@electric-sql/pglite"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Queue from "effect/Queue"
import * as Scope from "effect/Scope"
import * as Semaphore from "effect/Semaphore"
import * as Stream from "effect/Stream"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type { Connection } from "effect/unstable/sql/SqlConnection"
import {
  AuthenticationError,
  AuthorizationError,
  ConnectionError,
  ConstraintError,
  DeadlockError,
  LockTimeoutError,
  SerializationError,
  SqlError,
  SqlSyntaxError,
  StatementTimeoutError,
  UnknownError
} from "effect/unstable/sql/SqlError"
import type { Custom, Fragment } from "effect/unstable/sql/Statement"
import * as Statement from "effect/unstable/sql/Statement"

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: TypeId = "~@effect/sql-pglite/PgliteClient"

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = "~@effect/sql-pglite/PgliteClient"

/**
 * @category models
 * @since 1.0.0
 */
export interface PgliteClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: PgliteClientConfig
  readonly pglite: PGliteInterface
  readonly json: (_: unknown) => Fragment
  readonly listen: (channel: string) => Stream.Stream<string, SqlError>
  readonly notify: (channel: string, payload: string) => Effect.Effect<void, SqlError>
  readonly dumpDataDir: (compression?: "none" | "gzip" | "auto") => Effect.Effect<File | Blob, SqlError>
  readonly refreshArrayTypes: Effect.Effect<void, SqlError>
}

/**
 * @category tags
 * @since 1.0.0
 */
export const PgliteClient = Context.Service<PgliteClient>("@effect/sql-pglite/PgliteClient")

const PgliteTransaction = Context.Service<readonly [PgliteConnection, counter: number]>(
  "@effect/sql-pglite/PgliteClient/PgliteTransaction"
)

/**
 * @category models
 * @since 1.0.0
 */
export type PgliteClientConfig = PgliteClientConfig.Create | PgliteClientConfig.Live

/**
 * @category models
 * @since 1.0.0
 */
export declare namespace PgliteClientConfig {
  /**
   * @category models
   * @since 1.0.0
   */
  export interface Base {
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly transformResultNames?: ((str: string) => string) | undefined
    readonly transformQueryNames?: ((str: string) => string) | undefined
    readonly transformJson?: boolean | undefined
  }

  /**
   * @category models
   * @since 1.0.0
   */
  export interface Create extends Base, PGliteOptions {}

  /**
   * @category models
   * @since 1.0.0
   */
  export interface Live extends Base {
    readonly liveClient: PGliteInterface
  }

  /**
   * @category models
   * @since 1.0.0
   */
  export interface ConfigBase extends Base {
    readonly dataDir?: string | undefined
    readonly username?: string | undefined
    readonly database?: string | undefined
    readonly relaxedDurability?: boolean | undefined
  }
}

interface PgliteConnection extends Connection {}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: PgliteClientConfig
): Effect.Effect<PgliteClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const pglite: PGliteInterface = "liveClient" in options
      ? options.liveClient
      : yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            const pg = new PGlite(options as PGliteOptions)
            await pg.waitReady
            return pg as PGliteInterface
          },
          catch: (cause) => new SqlError({ reason: classifyError(cause, "PgliteClient: Failed to connect", "connect") })
        }),
        (pg) => Effect.promise(() => pg.close()).pipe(Effect.timeoutOption(1000))
      )

    return yield* fromClient({ ...options, liveClient: pglite })
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const fromClient = (
  options:
    & PgliteClientConfig.Base
    & {
      readonly liveClient: PGliteInterface
    }
): Effect.Effect<PgliteClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const pglite = options.liveClient
    const compiler = makeCompiler(options.transformQueryNames, options.transformJson)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames, options.transformJson).array
      : undefined

    const spanAttributes: Array<[string, unknown]> = [
      ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
      [ATTR_DB_SYSTEM_NAME, "postgresql"]
    ]

    class PgliteConnectionImpl implements PgliteConnection {
      private run(sql: string, params: ReadonlyArray<unknown>) {
        return Effect.map(
          Effect.tryPromise({
            try: () => pglite.query<any>(sql, params as Array<any>),
            catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to execute statement", "execute") })
          }),
          (result) => result.rows
        )
      }
      execute(
        sql: string,
        params: ReadonlyArray<unknown>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
      ) {
        return transformRows
          ? Effect.map(this.run(sql, params), transformRows)
          : this.run(sql, params)
      }
      executeRaw(sql: string, params: ReadonlyArray<unknown>) {
        return Effect.tryPromise({
          try: () => pglite.query<any>(sql, params as Array<any>),
          catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to execute statement", "execute") })
        })
      }
      executeValues(sql: string, params: ReadonlyArray<unknown>) {
        return Effect.map(
          Effect.tryPromise({
            try: () => pglite.query<any>(sql, params as Array<any>, { rowMode: "array" }),
            catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to execute statement", "execute") })
          }),
          (result) => result.rows as ReadonlyArray<ReadonlyArray<any>>
        )
      }
      executeUnprepared(
        sql: string,
        params: ReadonlyArray<unknown>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
      ) {
        return this.execute(sql, params, transformRows)
      }
      executeStream() {
        return Stream.die("executeStream not implemented")
      }
    }

    const connection: PgliteConnection = new PgliteConnectionImpl()
    const semaphore = yield* Semaphore.make(1)

    const transactionAcquirer: Effect.Effect<readonly [Scope.Closeable, PgliteConnection], SqlError> = Effect
      .uninterruptibleMask(Effect.fnUntraced(function*(restore) {
        const scope = Scope.makeUnsafe()
        yield* restore(semaphore.take(1))
        yield* Scope.addFinalizer(scope, semaphore.release(1))
        return [scope, connection] as const
      }))

    const withTransaction = Client.makeWithTransaction({
      transactionService: PgliteTransaction,
      spanAttributes,
      acquireConnection: transactionAcquirer,
      begin: (conn) => conn.executeRaw("BEGIN", []).pipe(Effect.asVoid),
      savepoint: (conn, id) => conn.executeRaw(`SAVEPOINT effect_sql_${id}`, []).pipe(Effect.asVoid),
      commit: (conn) => conn.executeRaw("COMMIT", []).pipe(Effect.asVoid),
      rollback: (conn) => conn.executeRaw("ROLLBACK", []).pipe(Effect.asVoid),
      rollbackSavepoint: (conn, id) => conn.executeRaw(`ROLLBACK TO SAVEPOINT effect_sql_${id}`, []).pipe(Effect.asVoid)
    })

    const acquirer = Effect.flatMap(
      Effect.serviceOption(PgliteTransaction),
      Option.match({
        onNone: () => semaphore.withPermits(1)(Effect.succeed(connection)),
        onSome: ([conn]) => Effect.succeed(conn)
      })
    )

    const withPglite = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
      Effect.flatMap(
        Effect.serviceOption(PgliteTransaction),
        Option.match({
          onNone: () => semaphore.withPermits(1)(effect),
          onSome: () => effect
        })
      )

    const config: PgliteClientConfig = options as PgliteClientConfig

    return Object.assign(
      yield* Client.make({
        acquirer,
        compiler,
        spanAttributes,
        transformRows
      }),
      {
        [TypeId]: TypeId as TypeId,
        config,
        withTransaction,
        pglite,
        json: (_: unknown) => Statement.fragment([PgJson(_)]),
        listen: (channel: string) =>
          Stream.callback<string, SqlError>(Effect.fnUntraced(function*(queue) {
            const unlisten = yield* Effect.tryPromise({
              try: () =>
                pglite.listen(channel, (payload) => {
                  Queue.offerUnsafe(queue, payload)
                }),
              catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to listen", "listen") })
            })
            yield* Effect.addFinalizer(() => Effect.promise(() => unlisten()))
          })),
        notify: (channel: string, payload: string) =>
          Effect.flatMap(
            acquirer,
            (conn) => conn.executeRaw("SELECT pg_notify($1, $2)", [channel, payload])
          ).pipe(Effect.asVoid),
        dumpDataDir: (compression?: "none" | "gzip" | "auto") =>
          withPglite(Effect.tryPromise({
            try: () => pglite.dumpDataDir(compression),
            catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to dump data dir", "dumpDataDir") })
          })),
        refreshArrayTypes: withPglite(Effect.tryPromise({
          try: () => pglite.refreshArrayTypes(),
          catch: (cause) =>
            new SqlError({ reason: classifyError(cause, "Failed to refresh array types", "refreshArrayTypes") })
        }))
      }
    )
  })

/**
 * @category layers
 * @since 1.0.0
 */
export const layerFrom = <E, R>(
  acquire: Effect.Effect<PgliteClient, E, R>
): Layer.Layer<PgliteClient | Client.SqlClient, E, Exclude<R, Scope.Scope | Reactivity.Reactivity>> =>
  Layer.effectContext(
    Effect.map(acquire, (client) =>
      Context.make(PgliteClient, client).pipe(
        Context.add(Client.SqlClient, client)
      ))
  ).pipe(Layer.provide(Reactivity.layer)) as any

/**
 * @category layers
 * @since 1.0.0
 */
export const layerConfig: (
  config: Config.Wrap<PgliteClientConfig.ConfigBase>
) => Layer.Layer<PgliteClient | Client.SqlClient, Config.ConfigError | SqlError> = (
  config: Config.Wrap<PgliteClientConfig.ConfigBase>
): Layer.Layer<PgliteClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  layerFrom(Effect.flatMap(
    Config.unwrap(config).asEffect(),
    (resolved) => make(resolved as PgliteClientConfig)
  ))

/**
 * @category layers
 * @since 1.0.0
 */
export const layer = (
  config: PgliteClientConfig
): Layer.Layer<PgliteClient | Client.SqlClient, SqlError> => layerFrom(make(config))

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler = (
  transform?: (_: string) => string,
  transformJson = true
): Statement.Compiler => {
  const transformValue = transformJson && transform
    ? Statement.defaultTransforms(transform).value
    : undefined

  return Statement.makeCompiler<PgCustom>({
    dialect: "pg",
    placeholder(_) {
      return `$${_}`
    },
    onIdentifier: transform ?
      function(value, withoutTransform) {
        return withoutTransform ? escape(value) : escape(transform(value))
      } :
      escape,
    onRecordUpdate(placeholders, valueAlias, valueColumns, values, returning) {
      return [
        `(values ${placeholders}) AS ${valueAlias}${valueColumns}${returning ? ` RETURNING ${returning[0]}` : ""}`,
        returning ?
          values.flat().concat(returning[1]) :
          values.flat()
      ]
    },
    onCustom(type, placeholder, withoutTransform) {
      switch (type.kind) {
        case "PgJson": {
          return [
            placeholder(undefined),
            [
              withoutTransform || transformValue === undefined
                ? type.paramA
                : transformValue(type.paramA)
            ]
          ]
        }
      }
    }
  })
}

const escape = Statement.defaultEscape("\"")

/**
 * @category custom types
 * @since 1.0.0
 */
export type PgCustom = PgJson

/**
 * @category custom types
 * @since 1.0.0
 */
interface PgJson extends Custom<"PgJson", unknown> {}
const PgJson = Statement.custom<PgJson>("PgJson")

const ATTR_DB_SYSTEM_NAME = "db.system.name"

const pgCodeFromCause = (cause: unknown): string | undefined => {
  if (typeof cause !== "object" || cause === null || !("code" in cause)) {
    return undefined
  }
  const code = cause.code
  return typeof code === "string" ? code : undefined
}

const classifyError = (
  cause: unknown,
  message: string,
  operation: string
) => {
  const props = { cause, message, operation }
  const code = pgCodeFromCause(cause)
  if (code !== undefined) {
    if (code.startsWith("08")) {
      return new ConnectionError(props)
    }
    if (code.startsWith("28")) {
      return new AuthenticationError(props)
    }
    if (code === "42501") {
      return new AuthorizationError(props)
    }
    if (code.startsWith("42")) {
      return new SqlSyntaxError(props)
    }
    if (code.startsWith("23")) {
      return new ConstraintError(props)
    }
    if (code === "40P01") {
      return new DeadlockError(props)
    }
    if (code === "40001") {
      return new SerializationError(props)
    }
    if (code === "55P03") {
      return new LockTimeoutError(props)
    }
    if (code === "57014") {
      return new StatementTimeoutError(props)
    }
  }
  return new UnknownError(props)
}
