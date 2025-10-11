/**
 * @since 1.0.0
 */
import * as WaSqlite from "@effect/wa-sqlite"
import SQLiteESMFactory from "@effect/wa-sqlite/dist/wa-sqlite.mjs"
import { MemoryVFS } from "@effect/wa-sqlite/src/examples/MemoryVFS.js"
import * as Config from "effect/Config"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as ScopedRef from "effect/ScopedRef"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/stream/Stream"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type { Connection } from "effect/unstable/sql/SqlConnection"
import { SqlError } from "effect/unstable/sql/SqlError"
import * as Statement from "effect/unstable/sql/Statement"
import type { OpfsWorkerMessage } from "./internal/opfsWorker.ts"

const ATTR_DB_SYSTEM_NAME = "db.system.name"

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: TypeId = "~@effect/sql-sqlite-wasm/SqliteClient"

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = "~@effect/sql-sqlite-wasm/SqliteClient"

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: SqliteClientMemoryConfig
  readonly export: Effect.Effect<Uint8Array, SqlError>
  readonly import: (data: Uint8Array) => Effect.Effect<void, SqlError>

  /** Not supported in sqlite */
  readonly updateValues: never
}

/**
 * @category tags
 * @since 1.0.0
 */
export const SqliteClient = ServiceMap.Service<SqliteClient>("@effect/sql-sqlite-wasm/SqliteClient")

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClientMemoryConfig {
  readonly installReactivityHooks?: boolean
  readonly spanAttributes?: Record<string, unknown>
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClientConfig {
  readonly worker: Effect.Effect<Worker | SharedWorker | MessagePort, never, Scope.Scope>
  readonly installReactivityHooks?: boolean
  readonly spanAttributes?: Record<string, unknown>
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

interface SqliteConnection extends Connection {
  readonly export: Effect.Effect<Uint8Array, SqlError>
  readonly import: (data: Uint8Array) => Effect.Effect<void, SqlError>
}

const initModule = Effect.runSync(
  Effect.cached(Effect.promise(() => SQLiteESMFactory()))
)

const initEffect = Effect.runSync(
  Effect.cached(initModule.pipe(Effect.map((module) => WaSqlite.Factory(module))))
)

const registered = new Set<string>()

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeMemory = (
  options: SqliteClientMemoryConfig
): Effect.Effect<SqliteClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const reactivity = yield* Reactivity.Reactivity
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames ?
      Statement.defaultTransforms(
        options.transformResultNames
      ).array :
      undefined

    const makeConnection = Effect.gen(function*() {
      const sqlite3 = yield* initEffect

      if (registered.has("memory-vfs") === false) {
        registered.add("memory-vfs")
        const module = yield* initModule
        // @ts-expect-error
        const vfs = new MemoryVFS("memory-vfs", module)
        sqlite3.vfs_register(vfs as any, false)
      }
      const db = yield* Effect.acquireRelease(
        Effect.try({
          try: () => sqlite3.open_v2(":memory:", undefined, "memory-vfs"),
          catch: (cause) => new SqlError({ cause, message: "Failed to open database" })
        }),
        (db) => Effect.sync(() => sqlite3.close(db))
      )

      if (options.installReactivityHooks) {
        sqlite3.update_hook(db, (_op, _db, table, rowid) => {
          if (!table) return
          const id = String(Number(rowid))
          reactivity.invalidateUnsafe({ [table]: [id] })
        })
      }

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
        rowMode: "object" | "array" = "object"
      ) =>
        Effect.try({
          try: () => {
            const results: Array<any> = []
            for (const stmt of sqlite3.statements(db, sql)) {
              let columns: Array<string> | undefined
              sqlite3.bind_collection(stmt, params as any)
              while (sqlite3.step(stmt) === WaSqlite.SQLITE_ROW) {
                columns = columns ?? sqlite3.column_names(stmt)
                const row = sqlite3.row(stmt)
                if (rowMode === "object") {
                  const obj: Record<string, any> = {}
                  for (let i = 0; i < columns.length; i++) {
                    obj[columns[i]] = row[i]
                  }
                  results.push(obj)
                } else {
                  results.push(row)
                }
              }
            }
            return results
          },
          catch: (cause) => new SqlError({ cause, message: "Failed to execute statement" })
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
          return run(sql, params, "array")
        },
        executeUnprepared(sql, params, transformRows) {
          return this.execute(sql, params, transformRows)
        },
        executeStream(sql, params, transformRows) {
          function* stream() {
            for (const stmt of sqlite3.statements(db, sql)) {
              let columns: Array<string> | undefined
              sqlite3.bind_collection(stmt, params as any)
              while (sqlite3.step(stmt) === WaSqlite.SQLITE_ROW) {
                columns = columns ?? sqlite3.column_names(stmt)
                const row = sqlite3.row(stmt)
                const obj: Record<string, any> = {}
                for (let i = 0; i < columns.length; i++) {
                  obj[columns[i]] = row[i]
                }
                yield obj
              }
            }
          }
          return Stream.suspend(() => Stream.fromIteratorSucceed(stream()[Symbol.iterator]())).pipe(
            transformRows
              ? Stream.mapArray((chunk) => transformRows(chunk) as any)
              : identity,
            Stream.mapError((cause) => new SqlError({ cause, message: "Failed to execute statement" }))
          )
        },
        export: Effect.try({
          try: () => sqlite3.serialize(db, "main"),
          catch: (cause) => new SqlError({ cause, message: "Failed to export database" })
        }),
        import(data) {
          return Effect.try({
            try: () => sqlite3.deserialize(db, "main", data, data.length, data.length, 1 | 2),
            catch: (cause) => new SqlError({ cause, message: "Failed to import database" })
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
        export: semaphore.withPermits(1)(connection.export),
        import(data: Uint8Array) {
          return semaphore.withPermits(1)(connection.import(data))
        }
      }
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig
): Effect.Effect<SqliteClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const reactivity = yield* Reactivity.Reactivity
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames ?
      Statement.defaultTransforms(options.transformResultNames).array :
      undefined
    const pending = new Map<number, (effect: Exit.Exit<any, SqlError>) => void>()

    const makeConnection = Effect.gen(function*() {
      let currentId = 0
      const scope = yield* Effect.scope
      const readyDeferred = yield* Deferred.make<void>()

      const worker = yield* options.worker
      const port = "port" in worker ? worker.port : worker
      const postMessage = (message: OpfsWorkerMessage, transferables?: ReadonlyArray<any>) =>
        port.postMessage(message, transferables as any)

      yield* Scope.addFinalizer(scope, Effect.sync(() => postMessage(["close"])))

      const onMessage = (event: any) => {
        const [id, error, results] = event.data
        if (id === "ready") {
          Deferred.doneUnsafe(readyDeferred, Exit.void)
          return
        } else if (id === "update_hook") {
          reactivity.invalidateUnsafe({ [error]: [results] })
          return
        } else {
          const resume = pending.get(id)
          if (!resume) return
          pending.delete(id)
          if (error) {
            resume(Exit.fail(new SqlError({ cause: error as string, message: "Failed to execute statement" })))
          } else {
            resume(Exit.succeed(results))
          }
        }
      }
      port.addEventListener("message", onMessage)

      function onError() {
        Effect.runFork(ScopedRef.set(connectionRef, makeConnection))
      }
      if ("onerror" in worker) {
        worker.addEventListener("error", onError)
      }

      yield* Scope.addFinalizer(
        scope,
        Effect.sync(() => {
          worker.removeEventListener("message", onMessage)
          worker.removeEventListener("error", onError)
        })
      )

      yield* Deferred.await(readyDeferred)

      if (options.installReactivityHooks) {
        postMessage(["update_hook"])
      }

      const send = (id: number, message: OpfsWorkerMessage, transferables?: ReadonlyArray<any>) =>
        Effect.callback<any, SqlError>((resume) => {
          pending.set(id, resume)
          postMessage(message, transferables)
        })

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
        rowMode: "object" | "array" = "object"
      ): Effect.Effect<Array<any>, SqlError, never> => {
        const rows = Effect.withFiber<[Array<string>, Array<any>], SqlError>((fiber) => {
          const id = currentId++
          return send(id, [id, sql, params], fiber.getRef(Transferables))
        })
        return rowMode === "object"
          ? Effect.map(rows, extractObject)
          : Effect.map(rows, extractRows)
      }

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
          return run(sql, params, "array")
        },
        executeUnprepared(sql, params, transformRows) {
          return this.execute(sql, params, transformRows)
        },
        executeStream() {
          return Stream.die("executeStream not implemented")
        },
        export: Effect.suspend(() => {
          const id = currentId++
          return send(id, ["export", id])
        }),
        import(data) {
          return Effect.suspend(() => {
            const id = currentId++
            return send(id, ["import", id, data], [data.buffer])
          })
        }
      })
    })

    const connectionRef = yield* ScopedRef.fromAcquire(makeConnection)

    const semaphore = yield* Effect.makeSemaphore(1)
    const acquirer = semaphore.withPermits(1)(ScopedRef.get(connectionRef))
    const transactionAcquirer = Effect.uninterruptibleMask(Effect.fnUntraced(function*(restore) {
      const fiber = Fiber.getCurrent()!
      const scope = ServiceMap.getUnsafe(fiber.services, Scope.Scope)
      yield* restore(semaphore.take(1))
      yield* Scope.addFinalizer(scope, semaphore.release(1))
      return yield* ScopedRef.get(connectionRef)
    }))

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
        export: Effect.flatMap(acquirer, (connection) => connection.export),
        import(data: Uint8Array) {
          return Effect.flatMap(acquirer, (connection) => connection.import(data))
        }
      }
    )
  })

function rowToObject(columns: Array<string>, row: Array<any>) {
  const obj: Record<string, any> = {}
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i]
  }
  return obj
}
const extractObject = (rows: [Array<string>, Array<any>]) => rows[1].map((row) => rowToObject(rows[0], row))
const extractRows = (rows: [Array<string>, Array<any>]) => rows[1]

/**
 * @category tranferables
 * @since 1.0.0
 */
export const Transferables = ServiceMap.Reference<ReadonlyArray<Transferable>>(
  "@effect/sql-sqlite-wasm/currentTransferables",
  { defaultValue: () => [] }
)

/**
 * @category tranferables
 * @since 1.0.0
 */
export const withTransferables =
  (transferables: ReadonlyArray<Transferable>) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.provideService(effect, Transferables, transferables)

/**
 * @category layers
 * @since 1.0.0
 */
export const layerMemoryConfig = (
  config: Config.Wrap<SqliteClientMemoryConfig>
): Layer.Layer<SqliteClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  Layer.effectServices(
    Config.unwrap(config).asEffect().pipe(
      Effect.flatMap(makeMemory),
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
export const layerMemory = (
  config: SqliteClientMemoryConfig
): Layer.Layer<SqliteClient | Client.SqlClient, SqlError> =>
  Layer.effectServices(
    Effect.map(makeMemory(config), (client) =>
      ServiceMap.make(SqliteClient, client).pipe(
        ServiceMap.add(Client.SqlClient, client)
      ))
  ).pipe(Layer.provide(Reactivity.layer))

/**
 * @category layers
 * @since 1.0.0
 */
export const layer = (
  config: SqliteClientConfig
): Layer.Layer<SqliteClient | Client.SqlClient, SqlError> =>
  Layer.effectServices(
    Effect.map(make(config), (client) =>
      ServiceMap.make(SqliteClient, client).pipe(
        ServiceMap.add(Client.SqlClient, client)
      ))
  ).pipe(Layer.provide(Reactivity.layer))

/**
 * @category layers
 * @since 1.0.0
 */
export const layerConfig = (
  config: Config.Wrap<SqliteClientConfig>
): Layer.Layer<SqliteClient | Client.SqlClient, Config.ConfigError | SqlError> =>
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
