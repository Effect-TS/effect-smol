/**
 * @since 1.0.0
 */
import * as Arr from "effect/collections/Array"
import * as Config from "effect/config/Config"
import * as Redacted from "effect/data/Redacted"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as RcRef from "effect/RcRef"
import * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"
import * as Channel from "effect/stream/Channel"
import * as Pull from "effect/stream/Pull"
import * as Stream from "effect/stream/Stream"
import * as Duration from "effect/time/Duration"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type { Connection } from "effect/unstable/sql/SqlConnection"
import { SqlError } from "effect/unstable/sql/SqlError"
import type { Custom, Fragment, Primitive } from "effect/unstable/sql/Statement"
import * as Statement from "effect/unstable/sql/Statement"
import type { ConnectionOptions } from "node:tls"
import * as Pg from "pg"
import Cursor from "pg-cursor"

const ATTR_DB_SYSTEM_NAME = "db.system.name"
const ATTR_DB_NAMESPACE = "db.namespace"
const ATTR_SERVER_ADDRESS = "server.address"
const ATTR_SERVER_PORT = "server.port"

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: TypeId = "~@effect/sql-pg/PgClient"

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = "~@effect/sql-pg/PgClient"

/**
 * @category models
 * @since 1.0.0
 */
export interface PgClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: PgClientConfig
  readonly json: (_: unknown) => Fragment
  readonly listen: (channel: string) => Stream.Stream<string, SqlError>
  readonly notify: (channel: string, payload: string) => Effect.Effect<void, SqlError>
}

/**
 * @category tags
 * @since 1.0.0
 */
export const PgClient = ServiceMap.Key<PgClient>("@effect/sql-pg/PgClient")

/**
 * @category constructors
 * @since 1.0.0
 */
export interface PgClientConfig {
  readonly url?: Redacted.Redacted | undefined

  readonly host?: string | undefined
  readonly port?: number | undefined
  readonly path?: string | undefined
  readonly ssl?: boolean | ConnectionOptions | undefined
  readonly database?: string | undefined
  readonly username?: string | undefined
  readonly password?: Redacted.Redacted | undefined

  readonly idleTimeout?: Duration.DurationInput | undefined
  readonly connectTimeout?: Duration.DurationInput | undefined

  readonly maxConnections?: number | undefined
  readonly minConnections?: number | undefined
  readonly connectionTTL?: Duration.DurationInput | undefined

  readonly applicationName?: string | undefined
  readonly spanAttributes?: Record<string, unknown> | undefined

  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
  readonly transformJson?: boolean | undefined
  readonly types?: Pg.CustomTypesConfig | undefined
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const make = (
  options: PgClientConfig
): Effect.Effect<PgClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const compiler = makeCompiler(
      options.transformQueryNames,
      options.transformJson
    )
    const transformRows = options.transformResultNames ?
      Statement.defaultTransforms(
        options.transformResultNames,
        options.transformJson
      ).array :
      undefined

    const pool = new Pg.Pool({
      connectionString: options.url ? Redacted.value(options.url) : undefined,
      user: options.username,
      host: options.host,
      database: options.database,
      password: options.password ? Redacted.value(options.password) : undefined,
      ssl: options.ssl,
      port: options.port,
      connectionTimeoutMillis: options.connectTimeout ? Duration.toMillis(options.connectTimeout) : undefined,
      idleTimeoutMillis: options.idleTimeout ? Duration.toMillis(options.idleTimeout) : undefined,
      max: options.maxConnections,
      min: options.minConnections,
      maxLifetimeSeconds: options.connectionTTL ? Duration.toSeconds(options.connectionTTL) : undefined,
      application_name: options.applicationName ?? "@effect/sql-pg",
      types: options.types
    })

    yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => pool.query("SELECT 1"),
        catch: (cause) => new SqlError({ cause, message: "PgClient: Failed to connect" })
      }),
      () =>
        Effect.promise(() => pool.end()).pipe(
          Effect.interruptible,
          Effect.timeoutOption(1000)
        )
    ).pipe(
      Effect.timeoutOrElse({
        duration: options.connectTimeout ?? Duration.seconds(5),
        onTimeout: () =>
          Effect.fail(
            new SqlError({
              cause: new Error("Connection timed out"),
              message: "PgClient: Connection timed out"
            })
          )
      })
    )

    class ConnectionImpl implements Connection {
      readonly pg: Pg.Pool | Pg.PoolClient
      constructor(pg: Pg.Pool | Pg.PoolClient) {
        this.pg = pg
      }

      private run(query: string, params: ReadonlyArray<Primitive>) {
        return Effect.callback<ReadonlyArray<any>, SqlError>((resume) => {
          this.pg.query(query, params as any, (err, result) => {
            if (err) {
              resume(Effect.fail(new SqlError({ cause: err, message: "Failed to execute statement" })))
            } else {
              resume(Effect.succeed(result.rows))
            }
          })
        })
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
        return Effect.callback<Pg.Result, SqlError>((resume) => {
          this.pg.query(sql, params as any, (err, result) => {
            if (err) {
              resume(Effect.fail(new SqlError({ cause: err, message: "Failed to execute statement" })))
            } else {
              resume(Effect.succeed(result))
            }
          })
        })
      }
      executeWithoutTransform(sql: string, params: ReadonlyArray<Primitive>) {
        return this.run(sql, params)
      }
      executeValues(sql: string, params: ReadonlyArray<Primitive>) {
        return Effect.callback<ReadonlyArray<any>, SqlError>((resume) => {
          this.pg.query(
            {
              text: sql,
              rowMode: "array",
              values: params as Array<string>
            },
            (err, result) => {
              if (err) {
                resume(Effect.fail(new SqlError({ cause: err, message: "Failed to execute statement" })))
              } else {
                resume(Effect.succeed(result.rows))
              }
            }
          )
        })
      }
      executeUnprepared(
        sql: string,
        params: ReadonlyArray<Primitive>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
      ) {
        return this.execute(sql, params, transformRows)
      }
      executeStream(
        sql: string,
        params: ReadonlyArray<Primitive>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
      ) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this
        return Stream.fromChannel(Channel.fromTransform(Effect.fnUntraced(function*(_, scope) {
          const cursor = self.pg.query(new Cursor(sql, params as any))
          yield* Scope.addFinalizer(scope, Effect.sync(() => cursor.close()))
          return Effect.callback<Arr.NonEmptyReadonlyArray<any>, SqlError | Pull.Halt<void>>((resume) => {
            cursor.read(128, (err, rows) => {
              if (err) {
                resume(Effect.fail(new SqlError({ cause: err, message: "Failed to execute statement" })))
              } else if (Arr.isNonEmptyArray(rows)) {
                resume(Effect.succeed(transformRows ? transformRows(rows) as any : rows))
              } else {
                resume(Pull.haltVoid)
              }
            })
          })
        })))
      }
    }

    const reserveRaw = Effect.callback<Pg.PoolClient, SqlError, Scope.Scope>((resume) => {
      const fiber = Fiber.getCurrent()!
      const scope = ServiceMap.unsafeGet(fiber.services, Scope.Scope)
      pool.connect((err, client, release) => {
        if (err) {
          resume(Effect.fail(new SqlError({ cause: err, message: "Failed to acquire connection for transaction" })))
        } else {
          resume(Effect.as(Scope.addFinalizer(scope, Effect.sync(release)), client!))
        }
      })
    })
    const reserve = Effect.map(reserveRaw, (client) => new ConnectionImpl(client))

    const listenClient = yield* RcRef.make({
      acquire: reserveRaw
    })

    return Object.assign(
      yield* Client.make({
        acquirer: Effect.succeed(new ConnectionImpl(pool)),
        transactionAcquirer: reserve,
        compiler,
        spanAttributes: [
          ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
          [ATTR_DB_SYSTEM_NAME, "postgresql"],
          [ATTR_DB_NAMESPACE, options.database ?? options.username ?? "postgres"],
          [ATTR_SERVER_ADDRESS, options.host ?? "localhost"],
          [ATTR_SERVER_PORT, options.port ?? 5432]
        ],
        transformRows
      }),
      {
        [TypeId]: TypeId as TypeId,
        config: {
          ...options,
          host: pool.options.host,
          port: pool.options.port,
          username: pool.options.user,
          password: typeof pool.options.password === "string" ? Redacted.make(pool.options.password) : undefined,
          database: pool.options.database
        },
        json: (_: unknown) => Statement.fragment([PgJson(_)]),
        listen: (channel: string) =>
          Stream.callback<string, SqlError>(Effect.fnUntraced(function*(queue) {
            const client = yield* RcRef.get(listenClient)
            function onNotification(msg: Pg.Notification) {
              if (msg.channel === channel && msg.payload) {
                Queue.unsafeOffer(queue, msg.payload)
              }
            }
            yield* Effect.addFinalizer(() =>
              Effect.promise(() => {
                client.off("notification", onNotification)
                return client.query(`UNLISTEN ${Pg.escapeIdentifier(channel)}`)
              })
            )
            yield* Effect.tryPromise({
              try: () => client.query(`LISTEN ${Pg.escapeIdentifier(channel)}`),
              catch: (cause) => new SqlError({ cause, message: "Failed to listen" })
            })
            client.on("notification", onNotification)
          })),
        notify: (channel: string, payload: string) =>
          Effect.callback<void, SqlError>((resume) => {
            pool.query(`NOTIFY ${Pg.escapeIdentifier(channel)}, $1`, [payload], (err) => {
              if (err) {
                resume(Effect.fail(new SqlError({ cause: err, message: "Failed to notify" })))
              } else {
                resume(Effect.void)
              }
            })
          })
      }
    )
  })

/**
 * @category layers
 * @since 1.0.0
 */
export const layerConfig = (
  config: Config.Wrap<PgClientConfig>
): Layer.Layer<PgClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  Layer.effectServices(
    Config.unwrap(config).asEffect().pipe(
      Effect.flatMap(make),
      Effect.map((client) =>
        ServiceMap.make(PgClient, client).pipe(
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
  config: PgClientConfig
): Layer.Layer<PgClient | Client.SqlClient, SqlError> =>
  Layer.effectServices(
    Effect.map(make(config), (client) =>
      ServiceMap.make(PgClient, client).pipe(
        ServiceMap.add(Client.SqlClient, client)
      ))
  ).pipe(Layer.provide(Reactivity.layer))

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
/**
 * @category custom types
 * @since 1.0.0
 */
const PgJson = Statement.custom<PgJson>("PgJson")
