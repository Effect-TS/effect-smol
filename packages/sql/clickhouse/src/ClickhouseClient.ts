/**
 * @since 1.0.0
 */
import * as Clickhouse from "@clickhouse/client"
import * as NodeStream from "@effect/platform-node/NodeStream"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/stream/Stream"
import * as Duration from "effect/time/Duration"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type { Connection } from "effect/unstable/sql/SqlConnection"
import { SqlError } from "effect/unstable/sql/SqlError"
import type { Primitive } from "effect/unstable/sql/Statement"
import * as Statement from "effect/unstable/sql/Statement"
import * as Crypto from "node:crypto"
import type { Readable } from "node:stream"

const ATTR_DB_SYSTEM_NAME = "db.system.name"
const ATTR_DB_NAMESPACE = "db.namespace"

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: TypeId = "~@effect/sql-clickhouse/ClickhouseClient"

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = "~@effect/sql-clickhouse/ClickhouseClient"

/**
 * @category models
 * @since 1.0.0
 */
export interface ClickhouseClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: ClickhouseClientConfig
  readonly param: (dataType: string, value: Statement.Primitive) => Statement.Fragment
  readonly asCommand: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly insertQuery: <T = unknown>(options: {
    readonly table: string
    readonly values: Clickhouse.InsertValues<Readable, T>
    readonly format?: Clickhouse.DataFormat
  }) => Effect.Effect<Clickhouse.InsertResult, SqlError>
  readonly withQueryId: {
    (queryId: string): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
    <A, E, R>(effect: Effect.Effect<A, E, R>, queryId: string): Effect.Effect<A, E, R>
  }
  readonly withClickhouseSettings: {
    (
      settings: NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>
    ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
    <A, E, R>(
      effect: Effect.Effect<A, E, R>,
      settings: NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>
    ): Effect.Effect<A, E, R>
  }
}

/**
 * @category tags
 * @since 1.0.0
 */
export const ClickhouseClient = ServiceMap.Key<ClickhouseClient>("@effect/sql-clickhouse/ClickhouseClient")

/**
 * @category constructors
 * @since 1.0.0
 */
export interface ClickhouseClientConfig extends Clickhouse.ClickHouseClientConfigOptions {
  readonly spanAttributes?: Record<string, unknown> | undefined
  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const make = (
  options: ClickhouseClientConfig
): Effect.Effect<ClickhouseClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined

    const client = Clickhouse.createClient(options)

    yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => client.exec({ query: "SELECT 1" }),
        catch: (cause) => new SqlError({ cause, message: "ClickhouseClient: Failed to connect" })
      }),
      () => Effect.promise(() => client.close())
    ).pipe(
      Effect.timeoutOrElse({
        duration: Duration.seconds(5),
        onTimeout: () =>
          Effect.fail(
            new SqlError({
              message: "ClickhouseClient: Connection timeout",
              cause: new Error("connection timeout")
            })
          )
      })
    )

    class ConnectionImpl implements Connection {
      private conn: Clickhouse.ClickHouseClient
      constructor(conn: Clickhouse.ClickHouseClient) {
        this.conn = conn
      }

      private runRaw(sql: string, params: ReadonlyArray<Primitive>, format: Clickhouse.DataFormat = "JSON") {
        const paramsObj: Record<string, unknown> = {}
        for (let i = 0; i < params.length; i++) {
          paramsObj[`p${i + 1}`] = params[i]
        }
        return Effect.withFiber<Clickhouse.ResultSet<"JSON"> | Clickhouse.CommandResult, SqlError>((fiber) => {
          const method = fiber.getRef(ClientMethod)
          return Effect.callback<Clickhouse.ResultSet<"JSON"> | Clickhouse.CommandResult, SqlError>((resume) => {
            const queryId = fiber.getRef(QueryId) ?? Crypto.randomUUID()
            const settings = fiber.getRef(ClickhouseSettings)
            const controller = new AbortController()
            if (method === "command") {
              this.conn.command({
                query: sql,
                query_params: paramsObj,
                abort_signal: controller.signal,
                query_id: queryId,
                clickhouse_settings: settings
              }).then(
                (result) => resume(Effect.succeed(result)),
                (cause) => resume(Effect.fail(new SqlError({ cause, message: "Failed to execute statement" })))
              )
            } else {
              this.conn.query({
                query: sql,
                query_params: paramsObj,
                abort_signal: controller.signal,
                query_id: queryId,
                clickhouse_settings: settings,
                format
              }).then(
                (result) => resume(Effect.succeed(result)),
                (cause) => resume(Effect.fail(new SqlError({ cause, message: "Failed to execute statement" })))
              )
            }
            return Effect.suspend(() => {
              controller.abort()
              return Effect.promise(() => this.conn.command({ query: `KILL QUERY WHERE query_id = '${queryId}'` }))
            })
          })
        })
      }

      private run(sql: string, params: ReadonlyArray<Primitive>, format?: Clickhouse.DataFormat) {
        return this.runRaw(sql, params, format).pipe(
          Effect.flatMap((result) => {
            if ("json" in result) {
              return Effect.promise(() =>
                result.json().then(
                  (result) => "data" in result ? result.data : result as any,
                  () => []
                )
              )
            }
            return Effect.succeed([])
          })
        )
      }

      execute(
        sql: string,
        params: ReadonlyArray<Primitive>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
      ) {
        return transformRows
          ? Effect.map(this.run(sql, params), transformRows)
          : this.run(sql, params)
      }
      executeRaw(sql: string, params: ReadonlyArray<Primitive>) {
        return this.runRaw(sql, params)
      }
      executeValues(sql: string, params: ReadonlyArray<Primitive>) {
        return this.run(sql, params, "JSONCompact")
      }
      executeUnprepared(sql: string, params: ReadonlyArray<Primitive>, transformRows?: any) {
        return this.execute(sql, params, transformRows)
      }
      executeStream(
        sql: string,
        params: ReadonlyArray<Primitive>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
      ) {
        return this.runRaw(sql, params, "JSONEachRow").pipe(
          Effect.map((result) => {
            if (!("stream" in result)) {
              return Stream.empty
            }
            return NodeStream.fromReadable<ReadonlyArray<Clickhouse.Row<any, "JSONEachRow">>, SqlError>({
              evaluate: () => result.stream() as any,
              onError: (cause) => new SqlError({ cause, message: "Failed to execute stream" })
            })
          }),
          Stream.unwrap,
          Stream.chunks,
          Stream.mapEffect((chunk) => {
            const promises: Array<Promise<any>> = []
            for (const rows of chunk) {
              for (const row of rows) {
                promises.push(row.json())
              }
            }
            return Effect.tryPromise({
              try: () => Promise.all(promises).then((rows) => transformRows ? transformRows(rows) : rows),
              catch: (cause) => new SqlError({ cause, message: "Failed to parse row" })
            })
          }),
          Stream.flattenIterable
        )
      }
    }

    const connection = new ConnectionImpl(client)

    return Object.assign(
      yield* Client.make({
        acquirer: Effect.succeed(connection),
        compiler,
        spanAttributes: [
          ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
          [ATTR_DB_SYSTEM_NAME, "clickhouse"],
          [ATTR_DB_NAMESPACE, options.database ?? "default"]
        ],
        beginTransaction: "BEGIN TRANSACTION",
        transformRows
      }),
      {
        [TypeId]: TypeId as TypeId,
        config: options,
        param(dataType: string, value: Statement.Primitive) {
          return Statement.fragment([clickhouseParam(dataType, value)])
        },
        asCommand<A, E, R>(effect: Effect.Effect<A, E, R>) {
          return Effect.provideService(effect, ClientMethod, "command")
        },
        insertQuery<T = unknown>(options: {
          readonly table: string
          readonly values: Clickhouse.InsertValues<Readable, T>
          readonly format?: Clickhouse.DataFormat
        }) {
          return Effect.callback<Clickhouse.InsertResult, SqlError>((resume) => {
            const fiber = Fiber.getCurrent()!
            const queryId = fiber.getRef(QueryId) ?? Crypto.randomUUID()
            const settings = fiber.getRef(ClickhouseSettings)
            const controller = new AbortController()
            client.insert({
              format: "JSONEachRow",
              ...options,
              abort_signal: controller.signal,
              query_id: queryId,
              clickhouse_settings: settings
            }).then(
              (result) => resume(Effect.succeed(result)),
              (cause) => resume(Effect.fail(new SqlError({ cause, message: "Failed to insert data" })))
            )
            return Effect.suspend(() => {
              controller.abort()
              return Effect.promise(() => client.command({ query: `KILL QUERY WHERE query_id = '${queryId}'` }))
            })
          })
        },
        withQueryId: dual(2, <A, E, R>(effect: Effect.Effect<A, E, R>, queryId: string) =>
          Effect.provideService(effect, QueryId, queryId)),
        withClickhouseSettings: dual(
          2,
          <A, E, R>(
            effect: Effect.Effect<A, E, R>,
            settings: NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>
          ) =>
            Effect.provideService(effect, ClickhouseSettings, settings)
        )
      }
    )
  })

/**
 * @category References
 * @since 1.0.0
 */
export const ClientMethod = ServiceMap.Reference<"query" | "command" | "insert">(
  "@effect/sql-clickhouse/ClickhouseClient/ClientMethod",
  {
    defaultValue: () => "query"
  }
)

/**
 * @category References
 * @since 1.0.0
 */
export const QueryId = ServiceMap.Reference<string | undefined>(
  "@effect/sql-clickhouse/ClickhouseClient/QueryId",
  { defaultValue: () => undefined }
)

/**
 * @category References
 * @since 1.0.0
 */
export const ClickhouseSettings: ServiceMap.Reference<
  NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>
> = ServiceMap.Reference("@effect/sql-clickhouse/ClickhouseClient/ClickhouseSettings", {
  defaultValue: () => ({})
})

/**
 * @category layers
 * @since 1.0.0
 */
export const layerConfig = (
  config: Config.Wrap<ClickhouseClientConfig>
): Layer.Layer<ClickhouseClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  Layer.effectServices(
    Config.unwrap(config).asEffect().pipe(
      Effect.flatMap(make),
      Effect.map((client) =>
        ServiceMap.make(ClickhouseClient, client).pipe(
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
  config: ClickhouseClientConfig
): Layer.Layer<ClickhouseClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  Layer.effectServices(
    Effect.map(make(config), (client) =>
      ServiceMap.make(ClickhouseClient, client).pipe(
        ServiceMap.add(Client.SqlClient, client)
      ))
  ).pipe(Layer.provide(Reactivity.layer))

const typeFromUnknown = (value: unknown): string => {
  if (Statement.isFragment(value)) {
    return typeFromUnknown(value.segments[0])
  } else if (isClickhouseParam(value)) {
    return value.paramA
  } else if (Array.isArray(value)) {
    return `Array(${typeFromUnknown(value[0])})`
  }
  switch (typeof value) {
    case "number":
      return "Decimal"
    case "bigint":
      return "Int64"
    case "boolean":
      return "Bool"
    case "object":
      if (value instanceof Date) {
        return "DateTime()"
      }
      return "String"
    default:
      return "String"
  }
}

/**
 * @category compiler
 * @since 1.0.0
 */
export const makeCompiler = (transform?: (_: string) => string) =>
  Statement.makeCompiler<ClickhouseCustom>({
    dialect: "sqlite",
    placeholder(i, u) {
      return `{p${i}: ${typeFromUnknown(u)}}`
    },
    onIdentifier: transform ?
      function(value, withoutTransform) {
        return withoutTransform ? escape(value) : escape(transform(value))
      } :
      escape,
    onRecordUpdate() {
      return ["", []]
    },
    onCustom(type, placeholder) {
      return [placeholder(type), [type.paramB]]
    }
  })

// compiler helpers

const escape = Statement.defaultEscape("\"")

/**
 * @category custom types
 * @since 1.0.0
 */
export type ClickhouseCustom = ClickhouseParam

/**
 * @category custom types
 * @since 1.0.0
 */
interface ClickhouseParam extends Statement.Custom<"ClickhouseParam", string, Statement.Primitive> {}

const clickhouseParam = Statement.custom<ClickhouseParam>("ClickhouseParam")
const isClickhouseParam = Statement.isCustom<ClickhouseParam>("ClickhouseParam")
