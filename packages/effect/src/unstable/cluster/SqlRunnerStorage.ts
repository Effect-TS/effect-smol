/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as SqlClient from "../sql/SqlClient.ts"
import type { SqlError } from "../sql/SqlError.ts"
import { PersistenceError } from "./ClusterError.ts"
import * as RunnerStorage from "./RunnerStorage.ts"

const withTracerDisabled = Effect.withTracerEnabled(false)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = Effect.fnUntraced(function*(options: {
  readonly prefix?: string | undefined
}) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms()
  const prefix = options?.prefix ?? "cluster"
  const table = (name: string) => `${prefix}_${name}`

  const runnersTable = table("runners")
  const runnersTableSql = sql(runnersTable)

  yield* sql.onDialectOrElse({
    mssql: () =>
      sql`
        IF OBJECT_ID(N'${runnersTableSql}', N'U') IS NULL
        CREATE TABLE ${runnersTableSql} (
          machine_id INT IDENTITY PRIMARY KEY,
          address VARCHAR(255) NOT NULL,
          runner TEXT NOT NULL,
          healthy BIT NOT NULL DEFAULT 1,
          last_heartbeat DATETIME NOT NULL DEFAULT GETDATE(),
          UNIQUE(address)
        )
      `,
    mysql: () =>
      sql`
        CREATE TABLE IF NOT EXISTS ${runnersTableSql} (
          machine_id INT AUTO_INCREMENT PRIMARY KEY,
          address VARCHAR(255) NOT NULL,
          runner TEXT NOT NULL,
          healthy BOOLEAN NOT NULL DEFAULT TRUE,
          last_heartbeat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(address)
        )
      `,
    pg: () =>
      sql`
        CREATE TABLE IF NOT EXISTS ${runnersTableSql} (
          machine_id SERIAL PRIMARY KEY,
          address VARCHAR(255) NOT NULL,
          runner TEXT NOT NULL,
          healthy BOOLEAN NOT NULL DEFAULT TRUE,
          last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(address)
        )
      `,
    orElse: () =>
      // sqlite
      sql`
        CREATE TABLE IF NOT EXISTS ${runnersTableSql} (
          machine_id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT NOT NULL,
          runner TEXT NOT NULL,
          healthy INTEGER NOT NULL DEFAULT 1,
          last_heartbeat DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          UNIQUE(address)
        )
      `
  })

  const locksTable = table("locks")
  const locksTableSql = sql(locksTable)

  yield* sql.onDialectOrElse({
    mssql: () =>
      sql`
        IF OBJECT_ID(N'${locksTableSql}', N'U') IS NULL
        CREATE TABLE ${locksTableSql} (
          shard_id VARCHAR(50) PRIMARY KEY,
          address VARCHAR(255) NOT NULL,
          acquired_at DATETIME NOT NULL
        )
      `,
    mysql: () =>
      sql`
        CREATE TABLE IF NOT EXISTS ${locksTableSql} (
          shard_id VARCHAR(50) PRIMARY KEY,
          address VARCHAR(255) NOT NULL,
          acquired_at DATETIME NOT NULL
        )
      `,
    pg: () =>
      sql`
        CREATE TABLE IF NOT EXISTS ${locksTableSql} (
          shard_id VARCHAR(50) PRIMARY KEY,
          address VARCHAR(255) NOT NULL,
          acquired_at TIMESTAMP NOT NULL
        )
      `,
    orElse: () =>
      // sqlite
      sql`
        CREATE TABLE IF NOT EXISTS ${locksTableSql} (
          shard_id TEXT PRIMARY KEY,
          address TEXT NOT NULL,
          acquired_at DATETIME NOT NULL
        )
      `
  })

  const sqlNowString = sql.onDialectOrElse({
    pg: () => "NOW()",
    mysql: () => "NOW()",
    mssql: () => "GETDATE()",
    orElse: () => "CURRENT_TIMESTAMP"
  })
  const sqlNow = sql.literal(sqlNowString)

  const lockExpiresAt = sql.onDialectOrElse({
    pg: () => sql`${sqlNow} - INTERVAL '5 seconds'`,
    mysql: () => sql`DATE_SUB(${sqlNow}, INTERVAL 5 SECOND)`,
    mssql: () => sql`DATEADD(SECOND, -5, ${sqlNow})`,
    orElse: () => sql`datetime(${sqlNow}, '-5 seconds')`
  })

  const encodeBoolean = sql.onDialectOrElse({
    mssql: () => (b: boolean) => (b ? 1 : 0),
    sqlite: () => (b: boolean) => (b ? 1 : 0),
    orElse: () => (b: boolean) => b
  })

  // Upsert runner and return machine_id
  const insertRunner = sql.onDialectOrElse({
    mssql: () => (address: string, runner: string, healthy: boolean) =>
      sql`
        MERGE ${runnersTableSql} AS target
        USING (SELECT ${address} AS address, ${runner} AS runner, ${sqlNow} AS last_heartbeat, ${
        encodeBoolean(healthy)
      } AS healthy) AS source
        ON target.address = source.address
        WHEN MATCHED THEN
          UPDATE SET runner = source.runner, last_heartbeat = source.last_heartbeat, healthy = source.healthy
        WHEN NOT MATCHED THEN
          INSERT (address, runner, last_heartbeat, healthy)
          VALUES (source.address, source.runner, source.last_heartbeat, source.healthy)
        OUTPUT INSERTED.machine_id;
      `.values,
    mysql: () => (address: string, runner: string, healthy: boolean) =>
      sql<{ machine_id: number }>`
        INSERT INTO ${runnersTableSql} (address, runner, last_heartbeat, healthy)
        VALUES (${address}, ${runner}, ${sqlNow}, ${healthy})
        ON DUPLICATE KEY UPDATE
          runner = VALUES(runner),
          last_heartbeat = VALUES(last_heartbeat),
          healthy = VALUES(healthy);
        SELECT machine_id FROM ${runnersTableSql} WHERE address = ${address};
      `.unprepared.pipe(
        Effect.map((results: any) => [[results[1][0].machine_id]])
      ),
    pg: () => (address: string, runner: string, healthy: boolean) =>
      sql`
        INSERT INTO ${runnersTableSql} (address, runner, last_heartbeat, healthy)
        VALUES (${address}, ${runner}, ${sqlNow}, ${healthy})
        ON CONFLICT (address) DO UPDATE
        SET runner = EXCLUDED.runner,
            last_heartbeat = EXCLUDED.last_heartbeat,
            healthy = EXCLUDED.healthy
        RETURNING machine_id
      `.values,
    orElse: () => (address: string, runner: string, healthy: boolean) =>
      // sqlite
      sql`
        INSERT INTO ${runnersTableSql} (address, runner, last_heartbeat, healthy)
        VALUES (${address}, ${runner}, ${sqlNow}, ${encodeBoolean(healthy)})
        ON CONFLICT(address) DO UPDATE SET
          runner = excluded.runner,
          last_heartbeat = excluded.last_heartbeat,
          healthy = excluded.healthy
        RETURNING machine_id;
      `.values
  })

  const acquireLock = sql.onDialectOrElse({
    pg: () => (address: string, values: Array<any>) =>
      sql`
        INSERT INTO ${locksTableSql} (shard_id, address, acquired_at) VALUES ${sql.csv(values)}
        ON CONFLICT (shard_id) DO UPDATE
        SET address = ${address}, acquired_at = ${sqlNow}
        WHERE ${locksTableSql}.address = ${address}
          OR ${locksTableSql}.acquired_at < ${lockExpiresAt}
      `,
    mysql: () => (_address: string, values: Array<any>) =>
      sql`
        INSERT INTO ${locksTableSql} (shard_id, address, acquired_at) VALUES ${sql.csv(values)}
        ON DUPLICATE KEY UPDATE
        address = IF(address = VALUES(address) OR acquired_at < ${lockExpiresAt}, VALUES(address), address),
        acquired_at = IF(address = VALUES(address) OR acquired_at < ${lockExpiresAt}, VALUES(acquired_at), acquired_at)
      `.unprepared,
    mssql: () => (_address: string, values: Array<any>) =>
      sql`
        MERGE ${locksTableSql} WITH (HOLDLOCK) AS target
        USING (SELECT * FROM (VALUES ${sql.csv(values)})) AS source (shard_id, address, acquired_at)
        ON target.shard_id = source.shard_id
        WHEN MATCHED AND (target.address = source.address OR DATEDIFF(SECOND, target.acquired_at, ${sqlNow}) > 5) THEN
          UPDATE SET address = source.address, acquired_at = source.acquired_at
        WHEN NOT MATCHED THEN
          INSERT (shard_id, address, acquired_at)
          VALUES (source.shard_id, source.address, source.acquired_at);
      `,
    orElse: () => (address: string, values: Array<any>) =>
      // sqlite
      sql`
        WITH source(shard_id, address, acquired_at) AS (VALUES ${sql.csv(values)})
        INSERT INTO ${locksTableSql} (shard_id, address, acquired_at)
        SELECT source.shard_id, source.address, source.acquired_at
        FROM source
        WHERE NOT EXISTS (
          SELECT 1 FROM ${locksTableSql}
          WHERE shard_id = source.shard_id
          AND address != ${address}
          AND (strftime('%s', ${sqlNow}) - strftime('%s', acquired_at)) <= 5
        )
        ON CONFLICT(shard_id) DO UPDATE
        SET address = ${address}, acquired_at = ${sqlNow}
      `
  })

  const wrapString = sql.onDialectOrElse({
    mssql: () => (s: string) => `N'${s}'`,
    orElse: () => (s: string) => `'${s}'`
  })
  const stringLiteral = (s: string) => sql.literal(wrapString(s))
  const wrapStringArr = (arr: ReadonlyArray<string>) => sql.literal(arr.map(wrapString).join(","))

  const refreshShards = sql.onDialectOrElse({
    mysql: () => (address: string, shardIds: ReadonlyArray<string>) => {
      const shardIdsStr = wrapStringArr(shardIds)
      return sql<Array<{ shard_id: string }>>`
        UPDATE ${locksTableSql}
        SET acquired_at = ${sqlNow}
        WHERE address = ${address} AND shard_id IN (${shardIdsStr});
        SELECT shard_id FROM ${locksTableSql} WHERE address = ${address} AND shard_id IN (${shardIdsStr})
      `.unprepared.pipe(
        Effect.map((rows) => rows[1].map((row) => [row.shard_id]))
      )
    },
    mssql: () => (address: string, shardIds: ReadonlyArray<string>) =>
      sql`
        UPDATE ${locksTableSql}
        SET acquired_at = ${sqlNow}
        OUTPUT inserted.shard_id
        WHERE address = ${address} AND shard_id IN (${wrapStringArr(shardIds)})
      `.values,
    orElse: () => (address: string, shardIds: ReadonlyArray<string>) =>
      sql`
        UPDATE ${locksTableSql}
        SET acquired_at = ${sqlNow}
        WHERE address = ${address} AND shard_id IN (${wrapStringArr(shardIds)})
        RETURNING shard_id
      `.values
  })

  return RunnerStorage.makeEncoded({
    getRunners: sql`SELECT runner, healthy FROM ${runnersTableSql} WHERE last_heartbeat > ${lockExpiresAt}`.values.pipe(
      PersistenceError.refail,
      Effect.map(Arr.map(([runner, healthy]) => [String(runner), Boolean(healthy)] as const)),
      withTracerDisabled
    ),

    register: (address, runner, healthy) =>
      insertRunner(address, runner, healthy).pipe(
        Effect.map((rows: any) => Number(rows[0][0])),
        PersistenceError.refail,
        withTracerDisabled
      ),

    unregister: (address) =>
      sql`DELETE FROM ${runnersTableSql} WHERE address = ${address} OR last_heartbeat < ${lockExpiresAt}`.pipe(
        Effect.asVoid,
        PersistenceError.refail,
        withTracerDisabled
      ),

    setRunnerHealth: (address, healthy) =>
      sql`UPDATE ${runnersTableSql} SET healthy = ${encodeBoolean(healthy)} WHERE address = ${address}`
        .pipe(
          Effect.asVoid,
          PersistenceError.refail,
          withTracerDisabled
        ),

    acquire: Effect.fnUntraced(
      function*(address, shardIds) {
        const values = shardIds.map((shardId) => sql`(${stringLiteral(shardId)}, ${stringLiteral(address)}, ${sqlNow})`)
        yield* acquireLock(address, values)
        const currentLocks = yield* sql<{ shard_id: string }>`
          SELECT shard_id FROM ${sql(locksTable)}
          WHERE address = ${address} AND acquired_at >= ${lockExpiresAt}
        `.values
        return currentLocks.map((row) => row[0] as string)
      },
      sql.withTransaction,
      PersistenceError.refail,
      withTracerDisabled
    ),

    refresh: (address, shardIds) =>
      sql`UPDATE ${runnersTableSql} SET last_heartbeat = ${sqlNow} WHERE address = ${address}`.pipe(
        shardIds.length === 0 ?
          Effect.as([]) :
          Effect.andThen(refreshShards(address, shardIds)),
        Effect.map((rows) => rows.map((row) => row[0] as string)),
        PersistenceError.refail,
        withTracerDisabled
      ),

    release: (address, shardId) =>
      sql`DELETE FROM ${locksTableSql} WHERE address = ${address} AND shard_id = ${shardId}`.pipe(
        PersistenceError.refail,
        withTracerDisabled
      ),

    releaseAll: (address) =>
      sql`DELETE FROM ${locksTableSql} WHERE address = ${address}`.pipe(
        PersistenceError.refail,
        withTracerDisabled
      )
  })
}, withTracerDisabled)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<
  RunnerStorage.RunnerStorage,
  SqlError,
  SqlClient.SqlClient
> = Layer.effect(RunnerStorage.RunnerStorage)(make({}))

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerWith = (options: {
  readonly prefix?: string | undefined
}): Layer.Layer<RunnerStorage.RunnerStorage, SqlError, SqlClient.SqlClient> =>
  Layer.effect(RunnerStorage.RunnerStorage)(make(options))
