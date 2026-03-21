import { NodeFileSystem } from "@effect/platform-node"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem } from "effect"
import { Reactivity } from "effect/unstable/reactivity"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { SqlError } from "effect/unstable/sql/SqlError"

describe("SqliteMigrator", () => {
  it.effect("fails when sqlite is locked during migration insert", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* fs.makeTempDirectoryScoped()
      const filename = dir + "/test.db"
      const [sqlA, sqlB] = yield* Effect.all([
        SqliteClient.make({ filename }),
        SqliteClient.make({ filename })
      ], { concurrency: 2 })

      yield* SqliteMigrator.run({
        loader: SqliteMigrator.fromRecord({})
      }).pipe(Effect.provideService(SqlClient.SqlClient, sqlA))

      yield* sqlB`PRAGMA busy_timeout = 1`

      const lockConnection = yield* sqlA.reserve
      yield* Effect.addFinalizer(() => lockConnection.executeUnprepared("ROLLBACK", [], undefined).pipe(Effect.ignore))
      yield* lockConnection.executeUnprepared("BEGIN IMMEDIATE", [], undefined)

      const error = yield* SqliteMigrator.run({
        loader: SqliteMigrator.fromRecord({
          "1_create_test": Effect.gen(function*() {
            const sql = yield* SqlClient.SqlClient
            yield* sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`
          })
        })
      }).pipe(
        Effect.provideService(SqlClient.SqlClient, sqlB),
        Effect.flip
      )

      assert.instanceOf(error, SqlError)
      assert.include(String((error.cause as { readonly message?: string }).message), "locked")
    }).pipe(Effect.provide([NodeFileSystem.layer, Reactivity.layer])))
})
