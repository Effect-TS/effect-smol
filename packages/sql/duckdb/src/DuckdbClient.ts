/**
 * DuckDB driver for Effect SQL, backed by `@duckdb/node-api`.
 *
 * This module can create a managed DuckDB instance, connect to an existing
 * instance, or wrap an existing connection. It exposes both the DuckDB-specific
 * {@link DuckdbClient} service and the generic Effect SQL client service. Rows
 * are returned as JavaScript values by default, while native DuckDB values and
 * JSON-compatible values are available through configuration. DuckDB does not
 * support SQL savepoints, so nested transaction failures roll back the outer
 * transaction.
 *
 * @since 4.0.0
 */
import * as DuckDB from "@duckdb/node-api"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as Semaphore from "effect/Semaphore"
import * as Stream from "effect/Stream"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type { Connection as SqlConnection } from "effect/unstable/sql/SqlConnection"
import {
  ConnectionError,
  ConstraintError,
  LockTimeoutError,
  SerializationError,
  SqlError,
  SqlSyntaxError,
  StatementTimeoutError,
  UniqueViolation,
  UnknownError
} from "effect/unstable/sql/SqlError"
import type { Custom, Fragment } from "effect/unstable/sql/Statement"
import * as Statement from "effect/unstable/sql/Statement"

const ATTR_DB_SYSTEM_NAME = "db.system.name"
const TypedParameterTypeId = "~@effect/sql-duckdb/DuckdbClient/TypedParameter"
let clientIdCounter = 0

/**
 * Runtime type identifier used to mark `DuckdbClient` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId: TypeId = "~@effect/sql-duckdb/DuckdbClient"

/**
 * Type-level identifier used to mark `DuckdbClient` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export type TypeId = "~@effect/sql-duckdb/DuckdbClient"

/**
 * Result conversion mode for DuckDB query rows.
 *
 * @category models
 * @since 4.0.0
 */
export type ResultMode = "js" | "native" | "json"

/**
 * DuckDB-specific `SqlClient` extension with access to the live connection,
 * optional instance, typed parameter fragments, appender/prepared statement
 * helpers, query interruption/progress, table-name discovery, and scalar
 * function registration.
 *
 * @category models
 * @since 4.0.0
 */
export interface DuckdbClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: DuckdbClientConfig
  readonly instance: DuckDB.DuckDBInstance | undefined
  readonly connection: DuckDB.DuckDBConnection
  readonly typed: (value: unknown, type: DuckDB.DuckDBType) => Fragment
  readonly interrupt: Effect.Effect<void, SqlError>
  readonly progress: Effect.Effect<DuckDB.DuckDBConnection["progress"]>
  readonly getTableNames: (
    query: string,
    qualified?: boolean | undefined
  ) => Effect.Effect<ReadonlyArray<string>, SqlError>
  readonly createAppender: (
    table: string,
    options?: {
      readonly schema?: string | null | undefined
      readonly catalog?: string | null | undefined
    } | undefined
  ) => Effect.Effect<DuckDB.DuckDBAppender, SqlError, Scope.Scope>
  readonly prepare: (sql: string) => Effect.Effect<DuckDB.DuckDBPreparedStatement, SqlError, Scope.Scope>
  readonly extractStatements: (sql: string) => Effect.Effect<DuckDB.DuckDBExtractedStatements, SqlError, Scope.Scope>
  readonly registerScalarFunction: (scalarFunction: DuckDB.DuckDBScalarFunction) => Effect.Effect<void, SqlError>
}

/**
 * Service tag for the active DuckDB SQL client.
 *
 * @category services
 * @since 4.0.0
 */
export const DuckdbClient = Context.Service<DuckdbClient>("@effect/sql-duckdb/DuckdbClient")

/**
 * Configuration for a DuckDB client, either by creating an instance, wrapping an
 * existing instance, or wrapping an existing connection.
 *
 * @category models
 * @since 4.0.0
 */
export type DuckdbClientConfig =
  | DuckdbClientConfig.Create
  | DuckdbClientConfig.LiveInstance
  | DuckdbClientConfig.LiveConnection

/**
 * Namespace containing the configuration variants for `DuckdbClient`.
 *
 * @since 4.0.0
 */
export declare namespace DuckdbClientConfig {
  /**
   * Shared DuckDB client options for span attributes, query/result name
   * transformations, and result value conversion.
   *
   * @category models
   * @since 4.0.0
   */
  export interface Base {
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly transformResultNames?: ((str: string) => string) | undefined
    readonly transformQueryNames?: ((str: string) => string) | undefined
    readonly resultMode?: ResultMode | undefined
  }

  /**
   * Configuration used to create a managed DuckDB instance.
   *
   * @category models
   * @since 4.0.0
   */
  export interface Create extends Base {
    readonly path?: string | undefined
    readonly configuration?: Record<string, string> | undefined
    readonly readonly?: boolean | undefined
    readonly cache?: boolean | undefined
  }

  /**
   * Configuration that connects to an existing DuckDB instance. The supplied
   * instance is caller-owned unless `closeInstance` is set to `true`.
   *
   * @category models
   * @since 4.0.0
   */
  export interface LiveInstance extends Base {
    readonly liveInstance: DuckDB.DuckDBInstance
    readonly closeInstance?: boolean | undefined
  }

  /**
   * Configuration that wraps an existing DuckDB connection. The supplied
   * connection and instance are caller-owned unless the close flags are set.
   *
   * @category models
   * @since 4.0.0
   */
  export interface LiveConnection extends Base {
    readonly liveConnection: DuckDB.DuckDBConnection
    readonly liveInstance?: DuckDB.DuckDBInstance | undefined
    readonly closeConnection?: boolean | undefined
    readonly closeInstance?: boolean | undefined
  }

  /**
   * Config-friendly subset of DuckDB creation options.
   *
   * @category models
   * @since 4.0.0
   */
  export interface ConfigBase extends Base {
    readonly path?: string | undefined
    readonly configuration?: Record<string, string> | undefined
    readonly readonly?: boolean | undefined
    readonly cache?: boolean | undefined
  }
}

interface TypedParameter {
  readonly [TypedParameterTypeId]: typeof TypedParameterTypeId
  readonly value: DuckDB.DuckDBValue
  readonly type: DuckDB.DuckDBType
}

interface TransactionState {
  readonly rollback: {
    value: boolean
  }
}

const TransactionState = Context.Service<TransactionState>("@effect/sql-duckdb/DuckdbClient/TransactionState")

type NormalizedParameters = readonly [
  values: ReadonlyArray<DuckDB.DuckDBValue> | undefined,
  types: ReadonlyArray<DuckDB.DuckDBType | undefined> | undefined
]

/**
 * Creates a scoped DuckDB SQL client. When `cache` is true, the client uses
 * DuckDB's process-local instance cache and only closes the connection.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (
  options: DuckdbClientConfig.Create = {}
): Effect.Effect<DuckdbClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const configuration = makeConfiguration(options)
    const instance = options.cache === true
      ? yield* Effect.tryPromise({
        try: () => DuckDB.DuckDBInstance.fromCache(options.path, configuration),
        catch: (cause) =>
          new SqlError({
            reason: classifyError(cause, "DuckdbClient: Failed to create instance", "connect", "connection")
          })
      })
      : yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => DuckDB.DuckDBInstance.create(options.path, configuration),
          catch: (cause) =>
            new SqlError({
              reason: classifyError(cause, "DuckdbClient: Failed to create instance", "connect", "connection")
            })
        }),
        closeInstance
      )

    return yield* fromInstance({
      ...options,
      liveInstance: instance,
      closeInstance: false
    })
  })

/**
 * Creates a scoped DuckDB SQL client from an existing DuckDB instance.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromInstance = (
  options:
    & DuckdbClientConfig.Base
    & {
      readonly liveInstance: DuckDB.DuckDBInstance
      readonly closeInstance?: boolean | undefined
    }
): Effect.Effect<DuckdbClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const connection = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => options.liveInstance.connect(),
        catch: (cause) =>
          new SqlError({ reason: classifyError(cause, "DuckdbClient: Failed to connect", "connect", "connection") })
      }),
      (connection) =>
        closeConnection(connection).pipe(
          Effect.andThen(options.closeInstance === true ? closeInstance(options.liveInstance) : Effect.void)
        )
    )

    return yield* fromConnection({
      ...options,
      liveConnection: connection,
      closeConnection: false,
      closeInstance: false
    })
  })

/**
 * Builds a `DuckdbClient` around an existing DuckDB connection.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromConnection = (
  options:
    & DuckdbClientConfig.Base
    & {
      readonly liveConnection: DuckDB.DuckDBConnection
      readonly liveInstance?: DuckDB.DuckDBInstance | undefined
      readonly closeConnection?: boolean | undefined
      readonly closeInstance?: boolean | undefined
    }
): Effect.Effect<DuckdbClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    if (options.closeConnection === true || options.closeInstance === true) {
      const scope = yield* Effect.scope
      yield* Scope.addFinalizer(
        scope,
        (options.closeConnection === true ? closeConnection(options.liveConnection) : Effect.void).pipe(
          Effect.andThen(
            options.closeInstance === true && options.liveInstance !== undefined
              ? closeInstance(options.liveInstance)
              : Effect.void
          )
        )
      )
    }

    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined

    const spanAttributes: Array<[string, unknown]> = [
      ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
      [ATTR_DB_SYSTEM_NAME, "duckdb"]
    ]

    const semaphore = Semaphore.makeUnsafe(1)
    const transactionService = Client.TransactionConnection(clientIdCounter++)
    const connection = new DuckdbConnection(
      options.liveConnection,
      options.resultMode ?? "js",
      options.liveInstance,
      transactionService
    )
    const acquirer = semaphore.withPermits(1)(Effect.succeed(connection))
    const transactionAcquirer = Effect.uninterruptibleMask((restore) => {
      const fiber = Fiber.getCurrent()!
      const scope = Context.getUnsafe(fiber.context, Scope.Scope)
      return Effect.as(
        Effect.tap(
          restore(semaphore.take(1)),
          () => Scope.addFinalizer(scope, semaphore.release(1))
        ),
        connection
      )
    })

    const client = yield* Client.make({
      acquirer,
      compiler,
      transactionAcquirer,
      transactionService,
      spanAttributes,
      transformRows
    })
    const withTransaction = makeWithTransaction({
      connection,
      semaphore,
      transactionService
    })

    return Object.assign(
      client,
      {
        [TypeId]: TypeId as TypeId,
        config: options as DuckdbClientConfig,
        instance: options.liveInstance,
        connection: options.liveConnection,
        withTransaction,
        transactionService,
        typed: (value: unknown, type: DuckDB.DuckDBType) => Statement.fragment([DuckdbTyped(value, type, undefined)]),
        interrupt: Effect.try({
          try: () => options.liveConnection.interrupt(),
          catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to interrupt query", "interrupt") })
        }),
        progress: Effect.sync(() => options.liveConnection.progress),
        getTableNames: (query: string, qualified = false) =>
          semaphore.withPermit(
            Effect.try({
              try: () => options.liveConnection.getTableNames(query, qualified),
              catch: (cause) =>
                new SqlError({ reason: classifyError(cause, "Failed to get table names", "getTableNames") })
            })
          ),
        createAppender: (
          table: string,
          appenderOptions?: {
            readonly schema?: string | null | undefined
            readonly catalog?: string | null | undefined
          } | undefined
        ) =>
          acquireWithPermit(
            semaphore,
            Effect.tryPromise({
              try: () =>
                options.liveConnection.createAppender(
                  table,
                  appenderOptions?.schema ?? undefined,
                  appenderOptions?.catalog ?? undefined
                ),
              catch: (cause) =>
                new SqlError({ reason: classifyError(cause, "Failed to create appender", "createAppender") })
            }),
            (appender) => Effect.sync(() => appender.closeSync()).pipe(Effect.ignore)
          ),
        prepare: (sql: string) =>
          acquireWithPermit(
            semaphore,
            Effect.tryPromise({
              try: () => options.liveConnection.prepare(sql),
              catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to prepare statement", "prepare") })
            }),
            (prepared) => Effect.sync(() => prepared.destroySync()).pipe(Effect.ignore)
          ),
        extractStatements: (sql: string) =>
          acquireWithPermit(
            semaphore,
            Effect.tryPromise({
              try: () => options.liveConnection.extractStatements(sql),
              catch: (cause) =>
                new SqlError({ reason: classifyError(cause, "Failed to extract statements", "extractStatements") })
            }),
            () => Effect.void
          ),
        registerScalarFunction: (scalarFunction: DuckDB.DuckDBScalarFunction) =>
          semaphore.withPermit(
            Effect.try({
              try: () => options.liveConnection.registerScalarFunction(scalarFunction),
              catch: (cause) =>
                new SqlError({
                  reason: classifyError(cause, "Failed to register scalar function", "registerScalarFunction")
                })
            })
          )
      }
    )
  })

const acquireWithPermit = <A, E, R>(
  semaphore: Semaphore.Semaphore,
  acquire: Effect.Effect<A, E, R>,
  release: (resource: A) => Effect.Effect<unknown>
): Effect.Effect<A, E, R | Scope.Scope> =>
  Effect.acquireRelease(
    Effect.uninterruptibleMask((restore) =>
      // Only release the permit if `take(1)` actually acquired it. Attaching the
      // compensating release to `take` as well would over-release when `take` is
      // interrupted while waiting (no permit held), driving the semaphore's
      // permit count negative and permanently breaking serialization.
      Effect.flatMap(restore(semaphore.take(1)), () =>
        restore(acquire).pipe(
          Effect.onError(() => semaphore.release(1))
        ))
    ),
    (resource) => release(resource).pipe(Effect.andThen(semaphore.release(1)))
  )

class DuckdbConnection implements SqlConnection {
  readonly connection: DuckDB.DuckDBConnection
  readonly resultMode: ResultMode
  readonly instance: DuckDB.DuckDBInstance | undefined
  readonly transactionService: Context.Service<Client.TransactionConnection, Client.TransactionConnection.Service>

  constructor(
    connection: DuckDB.DuckDBConnection,
    resultMode: ResultMode,
    instance: DuckDB.DuckDBInstance | undefined,
    transactionService: Context.Service<Client.TransactionConnection, Client.TransactionConnection.Service>
  ) {
    this.connection = connection
    this.resultMode = resultMode
    this.instance = instance
    this.transactionService = transactionService
  }

  // `normalizeParameters` runs inside the `try` so a parameter that cannot be
  // converted (e.g. an empty array, whose element type cannot be inferred)
  // surfaces as a recoverable `SqlError` instead of an eager defect.
  private runReader(method: string, sql: string, params: ReadonlyArray<unknown>) {
    return Effect.tryPromise({
      try: () => {
        const [values, types] = normalizeParameters(params)
        return this.connection.runAndReadAll(sql, values as any, types as any)
      },
      catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to execute statement", method) })
    })
  }

  private runRaw(method: string, sql: string, params: ReadonlyArray<unknown>) {
    return Effect.tryPromise({
      try: () => {
        const [values, types] = normalizeParameters(params)
        return this.connection.run(sql, values as any, types as any)
      },
      catch: (cause) => new SqlError({ reason: classifyError(cause, "Failed to execute statement", method) })
    })
  }

  execute(
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) {
    const rows = Effect.map(this.runReader("execute", sql, params), (reader) => getRowObjects(reader, this.resultMode))
    return transformRows ? Effect.map(rows, transformRows) : rows
  }

  executeRaw(sql: string, params: ReadonlyArray<unknown>) {
    return this.runRaw("executeRaw", sql, params)
  }

  executeValues(sql: string, params: ReadonlyArray<unknown>) {
    return Effect.map(this.runReader("executeValues", sql, params), (reader) => getRows(reader, this.resultMode))
  }

  executeValuesUnprepared(sql: string, params: ReadonlyArray<unknown>) {
    return this.executeValues(sql, params)
  }

  executeUnprepared(
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) {
    return this.execute(sql, params, transformRows)
  }

  executeStream(
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ) {
    // oxlint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    const mode = this.resultMode
    const emit = (rows: ReadonlyArray<any>) =>
      Stream.fromIterable(transformRows ? transformRows(rows as any) as any : rows)
    // A DuckDB streaming result is bound to its connection and is silently
    // truncated if any other statement runs on that connection before it is
    // fully consumed. Outside a transaction we therefore stream on a dedicated
    // connection (closed when the stream finishes/interrupts) so concurrent
    // queries on the main connection — including per-row queries during
    // consumption — cannot interfere. Inside a transaction (or when no instance
    // is available to open a connection) we must use the routed connection to
    // preserve transactional visibility, so we materialize the result up front
    // to avoid the truncation hazard.
    return Stream.unwrap(
      Effect.gen(function*() {
        const inTransaction = yield* Effect.serviceOption(self.transactionService)
        if (inTransaction._tag === "Some" || self.instance === undefined) {
          const reader = yield* self.runReader("executeStream", sql, params)
          return emit(getRowObjects(reader, mode))
        }
        const connection = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: () => self.instance!.connect(),
            catch: (cause) =>
              new SqlError({ reason: classifyError(cause, "Failed to connect", "executeStream", "connection") })
          }),
          (connection) => closeConnection(connection)
        )
        const result = yield* Effect.tryPromise({
          try: () => {
            const [values, types] = normalizeParameters(params)
            return connection.stream(sql, values as any, types as any)
          },
          catch: (cause) =>
            new SqlError({ reason: classifyError(cause, "Failed to stream statement", "executeStream") })
        })
        return Stream.fromAsyncIterable(
          rowObjectIterable(result, mode),
          (cause) => new SqlError({ reason: classifyError(cause, "Failed to stream statement", "executeStream") })
        ).pipe(Stream.flatMap(emit))
      })
    )
  }
}

/**
 * Creates a layer from an effect that acquires a `DuckdbClient`, providing both
 * `DuckdbClient` and `SqlClient`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerFrom = <E, R>(
  acquire: Effect.Effect<DuckdbClient, E, R>
): Layer.Layer<DuckdbClient | Client.SqlClient, E, Exclude<R, Scope.Scope | Reactivity.Reactivity>> =>
  Layer.effectContext(
    Effect.map(acquire, (client) =>
      Context.make(DuckdbClient, client).pipe(
        Context.add(Client.SqlClient, client)
      ))
  ).pipe(Layer.provide(Reactivity.layer)) as any

/**
 * Creates a layer from a `Config`-wrapped DuckDB client configuration,
 * providing both `DuckdbClient` and `SqlClient`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerConfig: (
  config: Config.Wrap<DuckdbClientConfig.ConfigBase>
) => Layer.Layer<DuckdbClient | Client.SqlClient, Config.ConfigError | SqlError> = (
  config: Config.Wrap<DuckdbClientConfig.ConfigBase>
): Layer.Layer<DuckdbClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  layerFrom(Effect.flatMap(Config.unwrap(config), (resolved) => make(resolved)))

/**
 * Creates a layer from a concrete DuckDB client configuration, providing both
 * `DuckdbClient` and `SqlClient`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = (
  config?: DuckdbClientConfig.Create | undefined
): Layer.Layer<DuckdbClient | Client.SqlClient, SqlError> => layerFrom(make(config))

/**
 * Creates the DuckDB statement compiler, using `?` placeholders and
 * double-quoted identifiers.
 *
 * @category constructors
 * @since 4.0.0
 */
export const makeCompiler = (transform?: (_: string) => string): Statement.Compiler =>
  Statement.makeCompiler<DuckdbCustom>({
    dialect: "duckdb",
    placeholder(_) {
      return "?"
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
    onCustom(type, placeholder) {
      switch (type.kind) {
        case "DuckdbTyped": {
          return [
            placeholder(undefined),
            [makeTypedParameter(type.paramA, type.paramB)]
          ]
        }
      }
    }
  })

const makeWithTransaction = (options: {
  readonly connection: DuckdbConnection
  readonly semaphore: Semaphore.Semaphore
  readonly transactionService: Context.Service<Client.TransactionConnection, Client.TransactionConnection.Service>
}) =>
// DuckDB does not support SAVEPOINT / ROLLBACK TO, so nested transactions are
// modeled by marking the whole outer transaction for rollback on nested failure.
<R, E, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | SqlError, R> =>
  Effect.uninterruptibleMask((restore) =>
    Effect.withFiber((fiber) => {
      const services = fiber.context
      const existing = Context.getOption(services, options.transactionService)
      if (existing._tag === "Some") {
        return Effect.flatMap(Effect.exit(restore(effect)), (exit) =>
          Exit.isSuccess(exit)
            ? exit
            : markTransactionRollback(services).pipe(Effect.andThen(exit)))
      }

      return Effect.acquireUseRelease(
        restore(options.semaphore.take(1)),
        () => {
          const state: TransactionState = { rollback: { value: false } }
          const context = Context.mutate(services, (services) =>
            services.pipe(
              Context.add(options.transactionService, [options.connection, 0]),
              Context.add(TransactionState, state)
            ))
          return options.connection.executeUnprepared("BEGIN", [], undefined).pipe(
            Effect.flatMap(() => Effect.exit(Effect.provideContext(restore(effect), context))),
            Effect.flatMap((exit) => {
              const finalizer = Exit.isSuccess(exit) && state.rollback.value === false
                ? options.connection.executeUnprepared("COMMIT", [], undefined)
                : options.connection.executeUnprepared("ROLLBACK", [], undefined)
              return Effect.flatMap(Effect.orDie(finalizer), () => exit)
            })
          )
        },
        () => options.semaphore.release(1)
      )
    })
  )

const markTransactionRollback = (context: Context.Context<never>) =>
  Effect.sync(() => {
    const state = Context.getOption(context, TransactionState)
    if (state._tag === "Some") {
      state.value.rollback.value = true
    }
  })

const closeConnection = (connection: DuckDB.DuckDBConnection) =>
  Effect.sync(() => connection.closeSync()).pipe(Effect.ignore)

const closeInstance = (instance: DuckDB.DuckDBInstance) => Effect.sync(() => instance.closeSync()).pipe(Effect.ignore)

const escape = Statement.defaultEscape("\"")

type DuckdbCustom = DuckdbTyped
interface DuckdbTyped extends Custom<"DuckdbTyped", unknown, DuckDB.DuckDBType> {}
const DuckdbTyped = Statement.custom<DuckdbTyped>("DuckdbTyped")

const makeTypedParameter = (value: unknown, type: DuckDB.DuckDBType): TypedParameter => ({
  [TypedParameterTypeId]: TypedParameterTypeId,
  value: normalizeValue(value),
  type
})

const isTypedParameter = (u: unknown): u is TypedParameter =>
  typeof u === "object" && u !== null && TypedParameterTypeId in u

const makeConfiguration = (options: DuckdbClientConfig.Create): Record<string, string> | undefined => {
  const configuration = { ...options.configuration }
  if (options.readonly === true && configuration.access_mode === undefined) {
    configuration.access_mode = "READ_ONLY"
  }
  return Object.keys(configuration).length === 0 ? undefined : configuration
}

const normalizeParameters = (params: ReadonlyArray<unknown>): NormalizedParameters => {
  if (params.length === 0) {
    return [undefined, undefined]
  }
  const values: Array<DuckDB.DuckDBValue> = new Array(params.length)
  let types: Array<DuckDB.DuckDBType | undefined> | undefined
  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    if (isTypedParameter(param)) {
      values[i] = param.value
      if (types === undefined) {
        types = new Array(params.length)
      }
      types[i] = param.type
    } else {
      values[i] = normalizeValue(param)
    }
  }
  return [values, types]
}

const normalizeValue = (value: unknown): DuckDB.DuckDBValue => {
  if (value === undefined || value === null) {
    return null
  }
  switch (typeof value) {
    case "boolean":
    case "number":
    case "bigint":
    case "string": {
      return value
    }
  }
  if (value instanceof Date) {
    return DuckDB.timestampMillisValue(BigInt(value.getTime()))
  }
  if (value instanceof Uint8Array) {
    return DuckDB.blobValue(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      // DuckDB cannot infer the element type of an empty list, so binding it
      // would fail with an opaque `LIST(ANY)` error. Direct the caller to the
      // typed-parameter API where the list type can be supplied explicitly.
      throw new Error(
        "Cannot bind an empty array: DuckDB cannot infer its element type. " +
          "Use `sql.typed(value, DuckDB.LIST(<elementType>))` instead."
      )
    }
    return DuckDB.listValue(value.map(normalizeValue))
  }
  if (typeof value === "object" && value !== null && value.constructor === Object) {
    const entries: Record<string, DuckDB.DuckDBValue> = {}
    for (const key in value as Record<string, unknown>) {
      entries[key] = normalizeValue((value as Record<string, unknown>)[key])
    }
    return DuckDB.structValue(entries)
  }
  return value as DuckDB.DuckDBValue
}

const getRowObjects = (
  reader: DuckDB.DuckDBResultReader,
  mode: ResultMode
): ReadonlyArray<any> => {
  switch (mode) {
    case "native": {
      return reader.getRowObjects()
    }
    case "json": {
      return reader.getRowObjectsJson()
    }
    case "js": {
      return reader.getRowObjectsJS()
    }
  }
}

const getRows = (
  reader: DuckDB.DuckDBResultReader,
  mode: ResultMode
): ReadonlyArray<ReadonlyArray<unknown>> => {
  switch (mode) {
    case "native": {
      return reader.getRows() as ReadonlyArray<ReadonlyArray<unknown>>
    }
    case "json": {
      return reader.getRowsJson() as ReadonlyArray<ReadonlyArray<unknown>>
    }
    case "js": {
      return reader.getRowsJS() as ReadonlyArray<ReadonlyArray<unknown>>
    }
  }
}

const rowObjectIterable = (
  result: DuckDB.DuckDBResult,
  mode: ResultMode
): AsyncIterable<ReadonlyArray<any>> => {
  switch (mode) {
    case "native": {
      return result.yieldRowObjects()
    }
    case "json": {
      return result.yieldRowObjectJson()
    }
    case "js": {
      return result.yieldRowObjectJs()
    }
  }
}

const causeMessage = (cause: unknown): string => {
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return cause.message
  }
  return String(cause)
}

const classifyError = (
  cause: unknown,
  message: string,
  operation: string,
  fallback: "connection" | "unknown" = "unknown"
) => {
  const props = { cause, message, operation }
  const errorMessage = causeMessage(cause)
  const lower = errorMessage.toLowerCase()

  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return new UniqueViolation({ ...props, constraint: duckdbConstraintFromMessage(errorMessage) })
  }
  if (lower.includes("constraint error") || lower.includes("violates")) {
    return new ConstraintError(props)
  }
  if (lower.includes("parser error") || lower.includes("syntax error")) {
    return new SqlSyntaxError(props)
  }
  if (lower.includes("transaction conflict") || lower.includes("write-write conflict")) {
    return new SerializationError(props)
  }
  if (lower.includes("database is locked") || lower.includes("lock timeout")) {
    return new LockTimeoutError(props)
  }
  if (lower.includes("interrupted") || lower.includes("cancelled") || lower.includes("canceled")) {
    return new StatementTimeoutError(props)
  }
  return fallback === "connection" ? new ConnectionError(props) : new UnknownError(props)
}

const duckdbConstraintFromMessage = (message: string): string => {
  const quoted = message.match(/constraint ["']([^"']+)["']/i)
  if (quoted !== null) {
    return quoted[1].trim() || "unknown"
  }
  const duplicate = message.match(/Duplicate key ["']?([^"'\n]+)["']?/i)
  if (duplicate !== null) {
    return duplicate[1].trim() || "unknown"
  }
  return "unknown"
}
