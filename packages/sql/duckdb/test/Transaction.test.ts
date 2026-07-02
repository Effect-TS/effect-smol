import { DuckdbClient } from "@effect/sql-duckdb"
import { assert, describe, layer } from "@effect/vitest"
import { Effect } from "effect"

const ClientLayer = DuckdbClient.layer()

const setup = (table: string) =>
  Effect.gen(function*() {
    const sql = yield* DuckdbClient.DuckdbClient
    yield* sql.unsafe(`DROP TABLE IF EXISTS ${table}`)
    yield* sql.unsafe(`CREATE TABLE ${table} (id INTEGER, name VARCHAR)`)
    return sql
  })

describe("DuckdbClient transactions", () => {
  layer(ClientLayer, { timeout: "30 seconds" })((it) => {
    it.effect("withTransaction commit", () =>
      Effect.gen(function*() {
        const sql = yield* setup("tx_commit")
        yield* sql.withTransaction(sql.unsafe(`INSERT INTO tx_commit VALUES (1, 'hello')`))
        const rows = yield* sql.unsafe<{ name: string }>(`SELECT name FROM tx_commit`)
        assert.deepStrictEqual(rows, [{ name: "hello" }])
      }))

    it.effect("withTransaction rollback", () =>
      Effect.gen(function*() {
        const sql = yield* setup("tx_rollback")
        yield* sql.unsafe(`INSERT INTO tx_rollback VALUES (1, 'hello')`).pipe(
          Effect.andThen(Effect.fail("boom")),
          sql.withTransaction,
          Effect.ignore
        )
        const rows = yield* sql.unsafe(`SELECT * FROM tx_rollback`)
        assert.deepStrictEqual(rows, [])
      }))

    it.effect("nested transaction commits both", () =>
      Effect.gen(function*() {
        const sql = yield* setup("tx_nested_commit")
        const first = sql.unsafe(`INSERT INTO tx_nested_commit VALUES (1, 'hello')`)
        const second = sql.unsafe(`INSERT INTO tx_nested_commit VALUES (2, 'world')`)
        yield* first.pipe(Effect.andThen(() => second.pipe(sql.withTransaction)), sql.withTransaction)
        const rows = yield* sql.unsafe<{ total: number }>(
          `SELECT count(*)::INTEGER AS total FROM tx_nested_commit`
        )
        assert.strictEqual(rows.at(0)?.total, 2)
      }))

    it.effect("nested transaction failure rolls back the outer transaction", () =>
      Effect.gen(function*() {
        const sql = yield* setup("tx_nested_rollback")
        yield* sql.unsafe(`INSERT INTO tx_nested_rollback VALUES (1, 'hello')`).pipe(
          Effect.andThen(() =>
            sql.unsafe(`INSERT INTO tx_nested_rollback VALUES (2, 'world')`).pipe(
              Effect.andThen(Effect.fail("boom")),
              sql.withTransaction,
              Effect.ignore
            )
          ),
          sql.withTransaction
        )
        const rows = yield* sql.unsafe<{ total: number }>(
          `SELECT count(*)::INTEGER AS total FROM tx_nested_rollback`
        )
        assert.strictEqual(rows.at(0)?.total, 0)
      }))
  })
})
