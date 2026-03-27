/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import type * as Scope from "../../Scope.ts"
import * as SqlClient from "../sql/SqlClient.ts"
import type * as SqlError from "../sql/SqlError.ts"
import { makeRemoteIdUnsafe, type RemoteEntry, type RemoteId } from "./EventJournal.ts"
import * as EventLogServerUnencrypted from "./EventLogServerUnencrypted.ts"

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeStorage = (options?: {
  readonly entryTablePrefix?: string
  readonly remoteIdTable?: string
  readonly insertBatchSize?: number
}): Effect.Effect<
  EventLogServerUnencrypted.Storage["Service"],
  SqlError.SqlError,
  SqlClient.SqlClient | Scope.Scope
> =>
  Effect.gen(function*() {
    const sql = (yield* SqlClient.SqlClient).withoutTransforms()

    const entriesTable = options?.entryTablePrefix ?? "effect_events"
    const remoteIdTable = options?.remoteIdTable ?? "effect_remote_id"
    const insertBatchSize = options?.insertBatchSize ?? 200
    const storesTable = `${entriesTable}_stores`

    const remoteIdTableSql = sql(remoteIdTable)
    const entriesTableSql = sql(entriesTable)
    const storesTableSql = sql(storesTable)

    yield* sql.onDialectOrElse({
      pg: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${remoteIdTableSql} (
            singleton INT PRIMARY KEY,
            remote_id BYTEA NOT NULL
          )`,
      mysql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${remoteIdTableSql} (
            singleton INT PRIMARY KEY,
            remote_id BINARY(16) NOT NULL
          )`,
      mssql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${remoteIdTableSql} (
            singleton INT PRIMARY KEY,
            remote_id VARBINARY(16) NOT NULL
          )`,
      orElse: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${remoteIdTableSql} (
            singleton INTEGER PRIMARY KEY,
            remote_id BLOB NOT NULL
          )`
    })

    yield* sql.onDialectOrElse({
      pg: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${entriesTableSql} (
            store_id TEXT NOT NULL,
            sequence BIGINT NOT NULL,
            entry_id BYTEA NOT NULL,
            event TEXT NOT NULL,
            primary_key TEXT NOT NULL,
            payload BYTEA NOT NULL,
            PRIMARY KEY (store_id, sequence),
            UNIQUE (store_id, entry_id)
          )`,
      mysql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${entriesTableSql} (
            store_id VARCHAR(191) NOT NULL,
            sequence BIGINT NOT NULL,
            entry_id BINARY(16) NOT NULL,
            event TEXT NOT NULL,
            primary_key TEXT NOT NULL,
            payload BLOB NOT NULL,
            PRIMARY KEY (store_id, sequence),
            UNIQUE (store_id, entry_id)
          )`,
      mssql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${entriesTableSql} (
            store_id NVARCHAR(191) NOT NULL,
            sequence BIGINT NOT NULL,
            entry_id VARBINARY(16) NOT NULL,
            event NVARCHAR(MAX) NOT NULL,
            primary_key NVARCHAR(MAX) NOT NULL,
            payload VARBINARY(MAX) NOT NULL,
            PRIMARY KEY (store_id, sequence),
            UNIQUE (store_id, entry_id)
          )`,
      orElse: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${entriesTableSql} (
            store_id TEXT NOT NULL,
            sequence INTEGER NOT NULL,
            entry_id BLOB NOT NULL,
            event TEXT NOT NULL,
            primary_key TEXT NOT NULL,
            payload BLOB NOT NULL,
            PRIMARY KEY (store_id, sequence),
            UNIQUE (store_id, entry_id)
          )`
    })

    yield* sql.onDialectOrElse({
      pg: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${storesTableSql} (
            store_id TEXT PRIMARY KEY,
            next_sequence BIGINT NOT NULL
          )`,
      mysql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${storesTableSql} (
            store_id VARCHAR(191) PRIMARY KEY,
            next_sequence BIGINT NOT NULL
          )`,
      mssql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${storesTableSql} (
            store_id NVARCHAR(191) PRIMARY KEY,
            next_sequence BIGINT NOT NULL
          )`,
      orElse: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${storesTableSql} (
            store_id TEXT PRIMARY KEY,
            next_sequence INTEGER NOT NULL
          )`
    })

    const selectRemoteId = sql<{ remote_id: Uint8Array }>`
      SELECT remote_id
      FROM ${remoteIdTableSql}
      WHERE singleton = 1
    `

    const remoteId = yield* selectRemoteId.pipe(
      Effect.flatMap((rows) => {
        const existing = rows[0]
        if (existing !== undefined) {
          return Effect.succeed(existing.remote_id as RemoteId)
        }

        const created = makeRemoteIdUnsafe()
        return sql`
          INSERT INTO ${remoteIdTableSql} (singleton, remote_id)
          VALUES (1, ${created})
        `.pipe(
          Effect.catchIf(
            (error: SqlError.SqlError) => error.reason._tag === "ConstraintError",
            () => Effect.void
          ),
          Effect.andThen(selectRemoteId),
          Effect.map((rows) => rows[0]?.remote_id as RemoteId | undefined),
          Effect.map((persisted) => persisted ?? created)
        )
      })
    )

    const pubsubs = yield* RcMap.make({
      lookup: (_storeId: string) =>
        Effect.acquireRelease(
          PubSub.unbounded<RemoteEntry>(),
          PubSub.shutdown
        ),
      idleTimeToLive: "5 minutes"
    })

    const withTransaction: EventLogServerUnencrypted.Storage["Service"]["withTransaction"] = sql
      .withTransaction as EventLogServerUnencrypted.Storage["Service"]["withTransaction"]

    return EventLogServerUnencrypted.Storage.of({
      getId: Effect.succeed(remoteId),
      write: Effect.fnUntraced(function*(storeId, entries) {
        if (entries.length === 0) {
          return {
            sequenceNumbers: [],
            committed: []
          }
        }

        yield* RcMap.get(pubsubs, storeId)
        for (let index = 0; index < entries.length; index += insertBatchSize) {
          entries.slice(index, index + insertBatchSize)
        }

        return yield* Effect.die("SqlEventLogServerUnencrypted.write is not implemented yet")
      }, Effect.scoped),
      entries: (_storeId, _startSequence) => Effect.succeed([] as Array<RemoteEntry>),
      changes: Effect.fnUntraced(function*(storeId, _startSequence) {
        const pubsub = yield* RcMap.get(pubsubs, storeId)
        const queue = yield* Queue.make<RemoteEntry>()
        const subscription = yield* PubSub.subscribe(pubsub)

        yield* PubSub.take(subscription).pipe(
          Effect.flatMap((entry) => Queue.offer(queue, entry)),
          Effect.forever,
          Effect.forkScoped
        )

        yield* Effect.addFinalizer(() => Queue.shutdown(queue))
        return Queue.asDequeue(queue)
      }),
      withTransaction
    })
  })

/**
 * @since 4.0.0
 * @category layers
 */
export const layerStorage = (options?: {
  readonly entryTablePrefix?: string
  readonly remoteIdTable?: string
  readonly insertBatchSize?: number
}): Layer.Layer<EventLogServerUnencrypted.Storage, SqlError.SqlError, SqlClient.SqlClient> =>
  Layer.effect(EventLogServerUnencrypted.Storage)(makeStorage(options))
