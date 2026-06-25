import { DuckdbClient, DuckdbMigrator } from "@effect/sql-duckdb"
import { assert, describe, layer } from "@effect/vitest"
import { Effect } from "effect"
import { SqlClient } from "effect/unstable/sql/SqlClient"

const ClientLayer = DuckdbClient.layer()

describe("DuckdbMigrator", () => {
  layer(ClientLayer, { timeout: "30 seconds" })((it) => {
    it.effect("runs migrations", () =>
      Effect.gen(function*() {
        const completed = yield* DuckdbMigrator.run({
          loader: DuckdbMigrator.fromRecord({
            "1_create": Effect.gen(function*() {
              const sql = yield* SqlClient
              yield* sql`CREATE TABLE migrated (id INTEGER PRIMARY KEY, name VARCHAR)`
            }),
            "2_insert": Effect.gen(function*() {
              const sql = yield* SqlClient
              yield* sql`INSERT INTO migrated VALUES (${1}, ${"duck"})`
            })
          })
        })
        assert.deepStrictEqual(completed, [[1, "create"], [2, "insert"]])

        const sql = yield* DuckdbClient.DuckdbClient
        const rows = yield* sql<{ id: number; name: string }>`SELECT * FROM migrated`
        assert.deepStrictEqual(rows, [{ id: 1, name: "duck" }])
      }))
  })
})
