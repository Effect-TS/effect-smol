/**
 * @since 1.0.0
 */
import type { SqlStorage } from "@cloudflare/workers-types"
import { Clock } from "effect/Clock"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as Semaphore from "effect/Semaphore"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import * as Tracer from "effect/Tracer"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type { Connection } from "effect/unstable/sql/SqlConnection"
import { classifySqliteError, SqlError } from "effect/unstable/sql/SqlError"
import * as Statement from "effect/unstable/sql/Statement"

const ATTR_DB_SYSTEM_NAME = "db.system.name"

const classifyError = (cause: unknown, message: string, operation: string) =>
  classifySqliteError(cause, { message, operation })

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: TypeId = "~@effect/sql-sqlite-do/SqliteClient"

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = "~@effect/sql-sqlite-do/SqliteClient"

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: SqliteClientConfig

  /** Not supported in sqlite */
  readonly updateValues: never
}

/**
 * @category tags
 * @since 1.0.0
 */
export const SqliteClient = ServiceMap.Service<SqliteClient>("@effect/sql-sqlite-do/SqliteClient")

/**
 * @category models
 * @since 1.0.0
 */
export type SqliteClientConfig = SqliteClientConfig.Base & (
  | { readonly storage: SqliteClientConfig.Storage; readonly db?: SqlStorage | undefined }
  | { readonly db: SqlStorage; readonly storage?: undefined }
)

/**
 * @category models
 * @since 1.0.0
 */
export declare namespace SqliteClientConfig {
  /**
   * The DurableObjectStorage instance (`ctx.storage`). When provided,
   * `withTransaction` uses `storage.transactionSync()` to wrap SQL operations
   * in a real transaction and `db` is derived from `storage.sql`.
   *
   * Without this, transactions are not supported (DO's `sql.exec()` cannot
   * execute BEGIN/COMMIT/ROLLBACK).
   *
   * Note: Effects run inside `withTransaction` must be fully synchronous
   * (no async operations, no Effect.sleep, no concurrent effects). This is a
   * fundamental constraint of Cloudflare DO's transactionSync API.
   */
  export interface Storage {
    readonly sql: SqlStorage
    readonly transactionSync: <T>(closure: () => T) => T
  }
  export interface Base {
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly transformResultNames?: ((str: string) => string) | undefined
    readonly transformQueryNames?: ((str: string) => string) | undefined
  }
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig
): Effect.Effect<SqliteClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const db = options.storage ? options.storage.sql : options.db

    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined

    const makeConnection = Effect.gen(function*() {

      function* runIterator(
        sql: string,
        params: ReadonlyArray<unknown> = []
      ) {
        const cursor = db.exec(sql, ...params)
        const columns = cursor.columnNames
        for (const result of cursor.raw()) {
          const obj: any = {}
          for (let i = 0; i < columns.length; i++) {
            const value = result[i]
            obj[columns[i]] = value instanceof ArrayBuffer ? new Uint8Array(value) : value
          }
          yield obj
        }
      }

      const runStatement = (
        sql: string,
        params: ReadonlyArray<unknown> = []
      ): Effect.Effect<ReadonlyArray<any>, SqlError, never> =>
        Effect.try({
          try: () => Array.from(runIterator(sql, params)),
          catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to execute statement", "execute") })
        })

      const runValues = (
        sql: string,
        params: ReadonlyArray<unknown> = []
      ): Effect.Effect<ReadonlyArray<any>, SqlError, never> =>
        Effect.try({
          try: () =>
            Array.from(db.exec(sql, ...params).raw(), (row) => {
              for (let i = 0; i < row.length; i++) {
                const value = row[i]
                if (value instanceof ArrayBuffer) {
                  row[i] = new Uint8Array(value) as any
                }
              }
              return row
            }),
          catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to execute statement", "execute") })
        })

      return identity<Connection>({
        execute(sql, params, transformRows) {
          return transformRows
            ? Effect.map(runStatement(sql, params), transformRows)
            : runStatement(sql, params)
        },
        executeRaw(sql, params) {
          return runStatement(sql, params)
        },
        executeValues(sql, params) {
          return runValues(sql, params)
        },
        executeUnprepared(sql, params, transformRows) {
          return transformRows
            ? Effect.map(runStatement(sql, params), transformRows)
            : runStatement(sql, params)
        },
        executeStream(sql, params, transformRows) {
          return Stream.suspend(() => {
            const iterator = runIterator(sql, params)
            return Stream.fromIteratorSucceed(iterator, 128)
          }).pipe(
            transformRows
              ? Stream.mapArray((chunk) => transformRows(chunk) as any)
              : identity
          )
        }
      })
    })

    const semaphore = yield* Semaphore.make(1)
    const connection = yield* makeConnection

    const acquirer = semaphore.withPermits(1)(Effect.succeed(connection))

    const spanAttributes: Array<readonly [string, unknown]> = [
      ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
      [ATTR_DB_SYSTEM_NAME, "sqlite"]
    ]

    // When storage is provided, the custom withTransaction below overrides the
    // base client's transaction handling. This acquirer is still required by
    // Client.make but won't be exercised in the storage-provided path.
    const transactionAcquirer = options.storage
      ? Effect.uninterruptibleMask((restore) => {
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
      : Effect.die("transactions are not supported without providing `storage` to SqliteClient config")

    const baseClient = yield* Client.make({
      acquirer,
      compiler,
      transactionAcquirer,
      spanAttributes,
      transformRows
    })

    // When storage is provided, override withTransaction to use transactionSync.
    //
    // We cannot use Client.makeWithTransaction here because DO's sql.exec()
    // rejects transaction control statements (BEGIN, COMMIT, ROLLBACK,
    // SAVEPOINT). The only way to get a transaction is via the callback-based
    // storage.transactionSync(closure) API, which wraps the closure in
    // BEGIN/COMMIT internally. Since this is a single callback rather than
    // separate begin/commit/rollback steps, we run the entire user effect
    // synchronously via Effect.runSyncExitWith inside the closure, and throw
    // the failure Exit to trigger rollback.
    const { storage } = options
    const withTransaction = storage
      ? <R, E, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | SqlError, R> =>
        Effect.uninterruptibleMask((restore) =>
          Effect.useSpan(
            "sql.transaction",
            { kind: "client" },
            (span) =>
              Effect.withFiber<A, E | SqlError, R>((fiber) => {
                for (const [key, value] of spanAttributes) {
                  span.attribute(key, value)
                }
                const services = fiber.services
                const clock = fiber.getRef(Clock)
                const connOption = ServiceMap.getOption(services, Client.TransactionConnection)

                if (connOption._tag === "Some") {
                  // Already in a transaction - run flat (no savepoint support in DO)
                  return restore(effect)
                }

                // Provide TransactionConnection so the client's getConnection
                // finds it directly (bypassing the semaphore acquirer which
                // doesn't work inside runSyncExitWith), and so nested
                // withTransaction calls are detected.
                const txServices = ServiceMap.mutate(services, (s) =>
                  s.pipe(
                    ServiceMap.add(Client.TransactionConnection, [connection, 0] as const),
                    ServiceMap.add(Tracer.ParentSpan, span)
                  )
                )

                return Effect.suspend(() => {
                  try {
                    const value = storage.transactionSync(() => {
                      // txServices is built from fiber.services via ServiceMap.mutate,
                      // so it contains all ambient services. The `as any` cast is needed
                      // because the mutated map's type doesn't reflect R.
                      const exit = Effect.runSyncExitWith(txServices as any)(
                        restore(effect) as Effect.Effect<A, E | SqlError>
                      )
                      if (exit._tag === "Failure") {
                        throw exit // Trigger rollback
                      }
                      return exit.value
                    })
                    // Transaction committed
                    span.event("db.transaction.commit", clock.currentTimeNanosUnsafe())
                    return Effect.succeed(value) as Effect.Effect<A, E | SqlError, R>
                  } catch (thrown: any) {
                    span.event("db.transaction.rollback", clock.currentTimeNanosUnsafe())
                    if (Exit.isExit(thrown) && thrown._tag === "Failure") {
                      return Effect.failCause(thrown.cause) as Effect.Effect<A, E | SqlError, R>
                    }
                    // Unexpected error from transactionSync itself
                    return Effect.fail(
                      new SqlError({
                        reason: classifyError(thrown, "Transaction failed", "transaction")
                      })
                    ) as Effect.Effect<A, E | SqlError, R>
                  }
                })
              })
          )
        )
      : baseClient.withTransaction

    return Object.assign(
      baseClient as SqliteClient,
      {
        [TypeId]: TypeId as TypeId,
        config: options,
        withTransaction
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
