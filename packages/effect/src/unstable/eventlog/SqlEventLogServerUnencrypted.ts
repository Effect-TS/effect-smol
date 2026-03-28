/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as Option from "../../Option.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as SqlClient from "../sql/SqlClient.ts"
import * as SqlError from "../sql/SqlError.ts"
import { Entry, EntryId, makeRemoteIdUnsafe, RemoteEntry, type RemoteId } from "./EventJournal.ts"
import * as EventLogServerUnencrypted from "./EventLogServerUnencrypted.ts"

const copyUint8Array = (bytes: Uint8Array): Uint8Array => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

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
    const sessionAuthBindingsTable = `${entriesTable}_session_auth_bindings`

    const remoteIdTableSql = sql(remoteIdTable)
    const entriesTableSql = sql(entriesTable)
    const storesTableSql = sql(storesTable)
    const sessionAuthBindingsTableSql = sql(sessionAuthBindingsTable)

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

    yield* sql.onDialectOrElse({
      pg: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${sessionAuthBindingsTableSql} (
            public_key TEXT PRIMARY KEY,
            signing_public_key BYTEA NOT NULL
          )`,
      mysql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${sessionAuthBindingsTableSql} (
            public_key VARCHAR(191) PRIMARY KEY,
            signing_public_key BINARY(32) NOT NULL
          )`,
      mssql: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${sessionAuthBindingsTableSql} (
            public_key NVARCHAR(191) PRIMARY KEY,
            signing_public_key VARBINARY(32) NOT NULL
          )`,
      orElse: () =>
        sql`
          CREATE TABLE IF NOT EXISTS ${sessionAuthBindingsTableSql} (
            public_key TEXT PRIMARY KEY,
            signing_public_key BLOB NOT NULL
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

    const publishCommitted = Effect.fnUntraced(
      function*(publication: PendingPublication) {
        if (publication.committed.length === 0) {
          return
        }

        const pubsub = yield* RcMap.get(pubsubs, publication.storeId)
        for (const remoteEntry of publication.committed) {
          yield* PubSub.publish(pubsub, remoteEntry)
        }
      },
      Effect.scoped
    )

    const flushPendingPublications = Effect.fnUntraced(function*(pending: ReadonlyArray<PendingPublication>) {
      for (const publication of pending) {
        yield* publishCommitted(publication)
      }
    })

    const withTransaction: EventLogServerUnencrypted.Storage["Service"]["withTransaction"] = Effect.fnUntraced(
      function*(effect) {
        const pendingOption = yield* Effect.serviceOption(PendingPublications)
        if (Option.isSome(pendingOption)) {
          return yield* sql.withTransaction(effect)
        }

        const pending: Array<PendingPublication> = []
        const result = yield* sql.withTransaction(effect).pipe(
          Effect.provideService(PendingPublications, { pending })
        )
        yield* flushPendingPublications(pending)
        return result
      },
      Effect.catchIf(SqlError.isSqlError, Effect.die)
    )

    const ensureStore = (storeId: string) =>
      sql.onDialectOrElse({
        pg: () =>
          sql`
            INSERT INTO ${storesTableSql} (store_id, next_sequence)
            VALUES (${storeId}, 1)
            ON CONFLICT (store_id) DO NOTHING
          `,
        mysql: () =>
          sql`
            INSERT INTO ${storesTableSql} (store_id, next_sequence)
            VALUES (${storeId}, 1)
            ON DUPLICATE KEY UPDATE store_id = store_id
          `,
        mssql: () =>
          sql`
            MERGE ${storesTableSql} WITH (HOLDLOCK) AS target
            USING (SELECT ${storeId} AS store_id, 1 AS next_sequence) AS source
              ON target.store_id = source.store_id
            WHEN NOT MATCHED THEN
              INSERT (store_id, next_sequence)
              VALUES (source.store_id, source.next_sequence);
          `,
        orElse: () =>
          sql`
            INSERT INTO ${storesTableSql} (store_id, next_sequence)
            VALUES (${storeId}, 1)
            ON CONFLICT DO NOTHING
          `
      })

    const lockStore = (storeId: string) =>
      sql.onDialectOrElse({
        pg: () =>
          sql`
            SELECT next_sequence
            FROM ${storesTableSql}
            WHERE store_id = ${storeId}
            FOR UPDATE
          `,
        mysql: () =>
          sql`
            SELECT next_sequence
            FROM ${storesTableSql}
            WHERE store_id = ${storeId}
            FOR UPDATE
          `,
        mssql: () =>
          sql`
            SELECT next_sequence
            FROM ${storesTableSql} WITH (UPDLOCK, HOLDLOCK)
            WHERE store_id = ${storeId}
          `,
        orElse: () =>
          sql`
            UPDATE ${storesTableSql}
            SET next_sequence = next_sequence
            WHERE store_id = ${storeId}
            RETURNING next_sequence
          `
      }).pipe(
        Effect.flatMap(decodeStoreSequence)
      )

    const setNextSequence = (storeId: string, nextSequence: number) =>
      sql`
        UPDATE ${storesTableSql}
        SET next_sequence = ${nextSequence}
        WHERE store_id = ${storeId}
      `

    const selectEntriesAfter = (storeId: string, startSequence: number) =>
      sql`
        SELECT sequence, entry_id, event, primary_key, payload
        FROM ${entriesTableSql}
        WHERE store_id = ${storeId} AND sequence > ${startSequence}
        ORDER BY sequence ASC
      `.pipe(
        Effect.flatMap(decodeRemoteEntries)
      )

    const selectExistingEntries = (storeId: string, entryIds: ReadonlyArray<EntryId>) =>
      entryIds.length === 0
        ? Effect.succeed([] as ReadonlyArray<RemoteEntry>)
        : sql`
            SELECT sequence, entry_id, event, primary_key, payload
            FROM ${entriesTableSql}
            WHERE store_id = ${storeId} AND ${sql.in("entry_id", entryIds)}
            ORDER BY sequence ASC
          `.pipe(
          Effect.flatMap(decodeRemoteEntries)
        )

    return EventLogServerUnencrypted.Storage.of({
      getId: Effect.succeed(remoteId),
      loadSessionAuthBindings: sql`
        SELECT public_key, signing_public_key
        FROM ${sessionAuthBindingsTableSql}
      `.pipe(
        Effect.flatMap(decodeSessionAuthBindings),
        Effect.map((rows) =>
          new Map(
            rows.map((row) => [row.public_key, copyUint8Array(row.signing_public_key)] as const)
          )
        ),
        Effect.orDie
      ),
      getSessionAuthBinding: (publicKey) =>
        sql`
          SELECT public_key, signing_public_key
          FROM ${sessionAuthBindingsTableSql}
          WHERE public_key = ${publicKey}
        `.pipe(
          Effect.flatMap(decodeSessionAuthBindings),
          Effect.map((rows) => {
            const row = rows[0]
            return row === undefined ? undefined : copyUint8Array(row.signing_public_key)
          }),
          Effect.orDie
        ),
      putSessionAuthBindingIfAbsent: (publicKey, signingPublicKey) =>
        sql`
          INSERT INTO ${sessionAuthBindingsTableSql} (public_key, signing_public_key)
          VALUES (${publicKey}, ${signingPublicKey})
        `.pipe(
          Effect.as(true),
          Effect.catchIf(
            (error: SqlError.SqlError) => error.reason._tag === "ConstraintError",
            () => Effect.succeed(false)
          ),
          Effect.orDie
        ),
      write: Effect.fnUntraced(
        function*(storeId, entries) {
          if (entries.length === 0) {
            return {
              sequenceNumbers: [],
              committed: []
            }
          }

          const result = yield* Effect.gen(function*() {
            const uniqueEntries: Array<Entry> = []
            const seenIds = new Set<string>()

            for (const entry of entries) {
              if (seenIds.has(entry.idString)) {
                continue
              }
              seenIds.add(entry.idString)
              uniqueEntries.push(entry)
            }

            yield* ensureStore(storeId)
            const currentNextSequence = yield* lockStore(storeId)
            const existingEntries = yield* selectExistingEntries(
              storeId,
              uniqueEntries.map((entry) => entry.id)
            )

            const existingSequenceById = new Map<string, number>()
            for (const remoteEntry of existingEntries) {
              existingSequenceById.set(remoteEntry.entry.idString, remoteEntry.remoteSequence)
            }

            const committed: Array<RemoteEntry> = []
            const rowsForInsert: Array<{
              readonly store_id: string
              readonly sequence: number
              readonly entry_id: Uint8Array
              readonly event: string
              readonly primary_key: string
              readonly payload: Uint8Array
            }> = []

            for (const entry of uniqueEntries) {
              if (existingSequenceById.has(entry.idString)) {
                continue
              }

              const remoteSequence = currentNextSequence + committed.length
              committed.push(
                new RemoteEntry({
                  remoteSequence,
                  entry
                }, { disableChecks: true })
              )
              rowsForInsert.push({
                store_id: storeId,
                sequence: remoteSequence,
                entry_id: entry.id,
                event: entry.event,
                primary_key: entry.primaryKey,
                payload: entry.payload
              })
            }

            if (committed.length > 0) {
              yield* setNextSequence(storeId, currentNextSequence + committed.length)
              for (let index = 0; index < rowsForInsert.length; index += insertBatchSize) {
                yield* sql`
                INSERT INTO ${entriesTableSql} ${sql.insert(rowsForInsert.slice(index, index + insertBatchSize))}
              `
              }
            }

            const sequenceById = new Map(existingSequenceById)
            for (const remoteEntry of committed) {
              sequenceById.set(remoteEntry.entry.idString, remoteEntry.remoteSequence)
            }

            return {
              sequenceNumbers: entries.map((entry) => {
                const remoteSequence = sequenceById.get(entry.idString)
                if (remoteSequence !== undefined) {
                  return remoteSequence
                }

                throw new Error(`Missing sequence number for entry id: ${entry.idString}`)
              }),
              committed
            }
          }).pipe(sql.withTransaction)

          if (result.committed.length > 0) {
            const pendingOption = yield* Effect.serviceOption(PendingPublications)
            if (Option.isSome(pendingOption)) {
              pendingOption.value.pending.push({
                storeId,
                committed: result.committed
              })
            } else {
              yield* publishCommitted({
                storeId,
                committed: result.committed
              })
            }
          }

          return result
        },
        Effect.orDie,
        Effect.scoped
      ),
      entries: (storeId, startSequence) => selectEntriesAfter(storeId, startSequence).pipe(Effect.orDie),
      changes: Effect.fnUntraced(function*(storeId, startSequence) {
        const queue = yield* Queue.make<RemoteEntry>()
        const pubsub = yield* RcMap.get(pubsubs, storeId)
        const subscription = yield* PubSub.subscribe(pubsub)
        const backlog = yield* selectEntriesAfter(storeId, startSequence)
        let watermark = backlog.length > 0 ? backlog[backlog.length - 1]!.remoteSequence : startSequence

        if (backlog.length > 0) {
          yield* Queue.offerAll(queue, backlog)
        }

        const pendingRows = yield* PubSub.takeUpTo(subscription, Number.POSITIVE_INFINITY)
        for (const remoteEntry of pendingRows) {
          if (remoteEntry.remoteSequence > watermark) {
            yield* Queue.offer(
              queue,
              new RemoteEntry({
                remoteSequence: remoteEntry.remoteSequence,
                entry: remoteEntry.entry
              }, { disableChecks: true })
            )
            watermark = remoteEntry.remoteSequence
          }
        }

        yield* PubSub.take(subscription).pipe(
          Effect.flatMap((remoteEntry) => {
            if (remoteEntry.remoteSequence <= watermark) {
              return Effect.void
            }

            watermark = remoteEntry.remoteSequence
            return Queue.offer(
              queue,
              new RemoteEntry({
                remoteSequence: remoteEntry.remoteSequence,
                entry: remoteEntry.entry
              }, { disableChecks: true })
            )
          }),
          Effect.forever,
          Effect.forkScoped
        )

        yield* Effect.addFinalizer(() => Queue.shutdown(queue))
        return Queue.asDequeue(queue)
      }, Effect.orDie),
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

type PendingPublication = {
  readonly storeId: string
  readonly committed: ReadonlyArray<RemoteEntry>
}

class PendingPublications extends ServiceMap.Service<PendingPublications, {
  readonly pending: Array<PendingPublication>
}>()("effect/eventlog/SqlEventLogServerUnencrypted/PendingPublications") {}

const EntrySql = Schema.Struct({
  entry_id: EntryId,
  event: Schema.String,
  primary_key: Schema.String,
  payload: Schema.Uint8Array
})

type EntrySql = Schema.Schema.Type<typeof EntrySql>

const SqlNumber = Schema.Union([Schema.Number, Schema.NumberFromString])

const RemoteEntrySql = Schema.Struct({
  ...EntrySql.fields,
  sequence: SqlNumber
})

type RemoteEntrySql = Schema.Schema.Type<typeof RemoteEntrySql>

const StoreSequenceSql = Schema.Struct({
  next_sequence: SqlNumber
})

const SessionAuthBindingSql = Schema.Struct({
  public_key: Schema.String,
  signing_public_key: Schema.Uint8Array
})

type SessionAuthBindingSql = Schema.Schema.Type<typeof SessionAuthBindingSql>

const decodeRemoteEntryRows = Schema.decodeUnknownEffect(Schema.Array(RemoteEntrySql))
const decodeStoreSequenceRows = Schema.decodeUnknownEffect(Schema.Array(StoreSequenceSql))
const decodeSessionAuthBindingRows = Schema.decodeUnknownEffect(Schema.Array(SessionAuthBindingSql))

const toEntry = (row: EntrySql): Entry =>
  new Entry({
    id: row.entry_id,
    event: row.event,
    primaryKey: row.primary_key,
    payload: row.payload
  }, { disableChecks: true })

const toRemoteEntry = (row: RemoteEntrySql): RemoteEntry =>
  new RemoteEntry({
    remoteSequence: row.sequence,
    entry: toEntry(row)
  }, { disableChecks: true })

const decodeRemoteEntries = (
  rows: unknown
): Effect.Effect<ReadonlyArray<RemoteEntry>, Schema.SchemaError> =>
  decodeRemoteEntryRows(rows).pipe(
    Effect.map((rows) => rows.map(toRemoteEntry))
  )

const decodeStoreSequence = (rows: unknown): Effect.Effect<number, Schema.SchemaError> =>
  decodeStoreSequenceRows(rows).pipe(
    Effect.flatMap((rows) => {
      const row = rows[0]
      if (row === undefined) {
        return Effect.die("SqlEventLogServerUnencrypted missing store sequence row")
      }
      return Effect.succeed(row.next_sequence)
    })
  )

const decodeSessionAuthBindings = (
  rows: unknown
): Effect.Effect<ReadonlyArray<SessionAuthBindingSql>, Schema.SchemaError> => decodeSessionAuthBindingRows(rows)
