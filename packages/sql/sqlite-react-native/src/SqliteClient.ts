/**
 * @since 1.0.0
 */
import * as Sqlite from "@op-engineering/op-sqlite"
import * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import { constFalse, identity } from "effect/Function"
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
export const TypeId: TypeId = "~@effect/sql-sqlite-react-native/SqliteClient"

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = "~@effect/sql-sqlite-react-native/SqliteClient"

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
export const SqliteClient = ServiceMap.Key<SqliteClient>("@effect/sql-sqlite-react-native/SqliteClient")

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClientConfig {
  readonly filename: string
  readonly location?: string | undefined
  readonly encryptionKey?: string | undefined
  readonly spanAttributes?: Record<string, unknown> | undefined
  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
}

/**
 * @category fiber refs
 * @since 1.0.0
 */
export const AsyncQuery = ServiceMap.Reference<boolean>(
  "@effect/sql-sqlite-react-native/Client/asyncQuery",
  { defaultValue: constFalse }
)

/**
 * @category fiber refs
 * @since 1.0.0
 */
export const withAsyncQuery = <R, E, A>(effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, AsyncQuery, true)

interface SqliteConnection extends Connection {}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig
): Effect.Effect<SqliteClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const clientOptions: Parameters<typeof Sqlite.open>[0] = {
      name: options.filename
    }
    if (options.location) {
      clientOptions.location = options.location
    }
    if (options.encryptionKey) {
      clientOptions.encryptionKey = options.encryptionKey
    }

    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames ?
      Statement.defaultTransforms(options.transformResultNames).array :
      undefined

    const makeConnection = Effect.gen(function*() {
      const db = Sqlite.open(clientOptions)
      yield* Effect.addFinalizer(() => Effect.sync(() => db.close()))

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
        values = false
      ) =>
        Effect.withFiber<Array<any>, SqlError>((fiber) => {
          if (fiber.getRef(AsyncQuery)) {
            return Effect.map(
              Effect.tryPromise({
                try: () => db.execute(sql, params as Array<any>),
                catch: (cause) => new SqlError({ cause, message: "Failed to execute statement (async)" })
              }),
              (result) => values ? result.rawRows ?? [] : result.rows
            )
          }
          return Effect.try({
            try: () => {
              const result = db.executeSync(sql, params as Array<any>)
              return values ? result.rawRows ?? [] : result.rows
            },
            catch: (cause) => new SqlError({ cause, message: "Failed to execute statement" })
          })
        })

      return identity<SqliteConnection>({
        execute(sql, params, transformRows) {
          return transformRows
            ? Effect.map(run(sql, params), transformRows)
            : run(sql, params)
        },
        executeRaw(sql, params) {
          return run(sql, params)
        },
        executeValues(sql, params) {
          return run(sql, params, true)
        },
        executeUnprepared(sql, params, transformRows) {
          return this.execute(sql, params, transformRows)
        },
        executeStream() {
          return Stream.die("executeStream not implemented")
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
        [TypeId]: TypeId,
        config: options
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
