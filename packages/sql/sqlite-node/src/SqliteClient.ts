/**
 * @since 1.0.0
 */
import Sqlite from "better-sqlite3"
import * as Cache from "effect/Cache"
import * as Config from "effect/Config"
import { Duration } from "effect/data"
import { identity } from "effect/data/Function"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/stream/Stream"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type { Connection } from "effect/unstable/sql/SqlConnection"
import { SqlError } from "effect/unstable/sql/SqlError"
import * as Statement from "effect/unstable/sql/Statement"

const ATTR_DB_SYSTEM_NAME = "db.system.name"

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: TypeId = "~@effect/sql-sqlite-node/SqliteClient"

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = "~@effect/sql-sqlite-node/SqliteClient"

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: SqliteClientConfig
  readonly export: Effect.Effect<Uint8Array, SqlError>
  readonly backup: (destination: string) => Effect.Effect<BackupMetadata, SqlError>
  readonly loadExtension: (path: string) => Effect.Effect<void, SqlError>

  /** Not supported in sqlite */
  readonly updateValues: never
}

/**
 * @category models
 * @since 1.0.0
 */
export interface BackupMetadata {
  readonly totalPages: number
  readonly remainingPages: number
}

/**
 * @category tags
 * @since 1.0.0
 */
export const SqliteClient = ServiceMap.Key<SqliteClient>("@effect/sql-sqlite-node/SqliteClient")

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClientConfig {
  readonly filename: string
  readonly readonly?: boolean | undefined
  readonly prepareCacheSize?: number | undefined
  readonly prepareCacheTTL?: Duration.DurationInput | undefined
  readonly disableWAL?: boolean | undefined
  readonly spanAttributes?: Record<string, unknown> | undefined

  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
}

interface SqliteConnection extends Connection {
  readonly export: Effect.Effect<Uint8Array, SqlError>
  readonly backup: (destination: string) => Effect.Effect<BackupMetadata, SqlError>
  readonly loadExtension: (path: string) => Effect.Effect<void, SqlError>
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig
): Effect.Effect<SqliteClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames ?
      Statement.defaultTransforms(
        options.transformResultNames
      ).array :
      undefined

    const makeConnection = Effect.gen(function*() {
      const scope = yield* Effect.scope
      const db = new Sqlite(options.filename, {
        readonly: options.readonly ?? false
      })
      yield* Scope.addFinalizer(scope, Effect.sync(() => db.close()))

      if (options.disableWAL !== true) {
        db.pragma("journal_mode = WAL")
      }

      const prepareCache = yield* Cache.make({
        capacity: options.prepareCacheSize ?? 200,
        timeToLive: options.prepareCacheTTL ?? Duration.minutes(10),
        lookup: (sql: string) =>
          Effect.try({
            try: () => db.prepare(sql),
            catch: (cause) => new SqlError({ cause, message: "Failed to prepare statement " })
          })
      })

      const runStatement = (
        statement: Sqlite.Statement,
        params: ReadonlyArray<Statement.Primitive>,
        raw: boolean
      ) =>
        Effect.withFiber<ReadonlyArray<any>, SqlError>((fiber) => {
          if (ServiceMap.get(fiber.services, Client.SafeIntegers)) {
            statement.safeIntegers(true)
          }
          try {
            if (statement.reader) {
              return Effect.succeed(statement.all(...params))
            }
            const result = statement.run(...params)
            return Effect.succeed(raw ? result as unknown as ReadonlyArray<any> : [])
          } catch (cause) {
            return Effect.fail(new SqlError({ cause, message: "Failed to execute statement" }))
          }
        })

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive>,
        raw = false
      ) =>
        Effect.flatMap(
          Cache.get(prepareCache, sql),
          (s) => runStatement(s, params, raw)
        )

      const runValues = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive>
      ) =>
        Effect.acquireUseRelease(
          Cache.get(prepareCache, sql),
          (statement) =>
            Effect.try({
              try: () => {
                if (statement.reader) {
                  statement.raw(true)
                  return statement.all(...params) as ReadonlyArray<
                    ReadonlyArray<Statement.Primitive>
                  >
                }
                statement.run(...params)
                return []
              },
              catch: (cause) => new SqlError({ cause, message: "Failed to execute statement" })
            }),
          (statement) => Effect.sync(() => statement.reader && statement.raw(false))
        )

      return identity<SqliteConnection>({
        execute(sql, params, transformRows) {
          return transformRows
            ? Effect.map(run(sql, params), transformRows)
            : run(sql, params)
        },
        executeRaw(sql, params) {
          return run(sql, params, true)
        },
        executeValues(sql, params) {
          return runValues(sql, params)
        },
        executeUnprepared(sql, params, transformRows) {
          const effect = runStatement(db.prepare(sql), params ?? [], false)
          return transformRows ? Effect.map(effect, transformRows) : effect
        },
        executeStream(_sql, _params) {
          return Stream.die("executeStream not implemented")
        },
        export: Effect.try({
          try: () => db.serialize(),
          catch: (cause) => new SqlError({ cause, message: "Failed to export database" })
        }),
        backup(destination) {
          return Effect.tryPromise({
            try: () => db.backup(destination),
            catch: (cause) => new SqlError({ cause, message: "Failed to backup database" })
          })
        },
        loadExtension(path) {
          return Effect.try({
            try: () => db.loadExtension(path),
            catch: (cause) => new SqlError({ cause, message: "Failed to load extension" })
          })
        }
      })
    })

    const semaphore = yield* Effect.makeSemaphore(1)
    const connection = yield* makeConnection

    const acquirer = semaphore.withPermits(1)(Effect.succeed(connection))
    const transactionAcquirer = Effect.uninterruptibleMask((restore) => {
      const fiber = Fiber.getCurrent()!
      const scope = ServiceMap.getUnsafe(fiber.services, Scope.Scope)
      return Effect.as(
        Effect.tap(
          restore(semaphore.take(1)),
          () => Scope.addFinalizer(scope, semaphore.release(1))
        ),
        connection
      )
    })

    return Object.assign(
      (yield* Client.make({
        acquirer,
        compiler,
        transactionAcquirer,
        spanAttributes: [
          ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
          [ATTR_DB_SYSTEM_NAME, "sqlite"]
        ],
        transformRows
      })) as SqliteClient,
      {
        [TypeId]: TypeId as TypeId,
        config: options,
        export: Effect.flatMap(acquirer, (_) => _.export),
        backup: (destination: string) => Effect.flatMap(acquirer, (_) => _.backup(destination)),
        loadExtension: (path: string) => Effect.flatMap(acquirer, (_) => _.loadExtension(path))
      }
    )
  })

/**
 * @category layers
 * @since 1.0.0
 */
export const layerConfig = (
  config: Config.Wrap<SqliteClientConfig>
): Layer.Layer<SqliteClient | Client.SqlClient, Config.ConfigError> =>
  Layer.effectServices(
    Config.unwrap(config).asEffect().pipe(
      Effect.flatMap(make),
      Effect.map((client) =>
        ServiceMap.make(SqliteClient, client).pipe(
          ServiceMap.add(Client.SqlClient, client)
        )
      )
    )
  ).pipe(Layer.provide(Reactivity.layer))

/**
 * @category layers
 * @since 1.0.0
 */
export const layer = (
  config: SqliteClientConfig
): Layer.Layer<SqliteClient | Client.SqlClient> =>
  Layer.effectServices(
    Effect.map(make(config), (client) =>
      ServiceMap.make(SqliteClient, client).pipe(
        ServiceMap.add(Client.SqlClient, client)
      ))
  ).pipe(Layer.provide(Reactivity.layer))
