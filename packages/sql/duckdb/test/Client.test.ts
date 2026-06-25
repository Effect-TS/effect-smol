import * as Duckdb from "@duckdb/node-api"
import { DuckdbClient } from "@effect/sql-duckdb"
import { assert, describe, it, layer } from "@effect/vitest"
import { Effect, Stream } from "effect"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"

const ClientLayer = DuckdbClient.layer()

const setup = (table: string) =>
  Effect.gen(function*() {
    const sql = yield* DuckdbClient.DuckdbClient
    yield* sql.unsafe(`DROP TABLE IF EXISTS ${table}`)
    yield* sql.unsafe(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, name VARCHAR)`)
    return sql
  })

describe("DuckdbClient", () => {
  layer(ClientLayer, { timeout: "30 seconds" })((it) => {
    it.effect("basic insert/select", () =>
      Effect.gen(function*() {
        const sql = yield* setup("basic_test")

        yield* sql`INSERT INTO basic_test (id, name) VALUES (${1}, ${"hello"})`

        const rows = yield* sql<{ id: number; name: string }>`SELECT * FROM basic_test`
        assert.deepStrictEqual(rows, [{ id: 1, name: "hello" }])

        const values = yield* sql`SELECT id, name FROM basic_test`.values
        assert.deepStrictEqual(values, [[1, "hello"]])

        const raw = yield* sql`SELECT id, name FROM basic_test`.raw
        assert.strictEqual((raw as Duckdb.DuckDBMaterializedResult).rowCount, 1)
      }))

    it.effect("compiler helpers", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient

        const [insertQuery, insertParams] = sql`INSERT INTO people ${
          sql.insert({ name: "Tim", age: 10 }).returning("*")
        }`.compile()
        assert.strictEqual(insertQuery, `INSERT INTO people ("name","age") VALUES (?,?) RETURNING *`)
        assert.deepStrictEqual(insertParams, ["Tim", 10])

        const [updateQuery, updateParams] = sql`UPDATE people SET ${sql.update({ name: "John" })}`.compile()
        assert.strictEqual(updateQuery, `UPDATE people SET "name" = ?`)
        assert.deepStrictEqual(updateParams, ["John"])

        const [updateValuesQuery, updateValuesParams] = sql`UPDATE people SET name = data.name FROM ${
          sql.updateValues([{ id: 1, name: "Tim" }, { id: 2, name: "John" }], "data")
        } WHERE people.id = data.id`.compile()
        assert.strictEqual(
          updateValuesQuery,
          `UPDATE people SET name = data.name FROM (values (?,?),(?,?)) AS data("id","name") WHERE people.id = data.id`
        )
        assert.deepStrictEqual(updateValuesParams, [1, "Tim", 2, "John"])

        const [inQuery, inParams] = sql`SELECT * FROM ${sql("people")} WHERE id IN ${sql.in([1, 2, 3])}`.compile()
        assert.strictEqual(inQuery, `SELECT * FROM "people" WHERE id IN (?,?,?)`)
        assert.deepStrictEqual(inParams, [1, 2, 3])

        assert.strictEqual(
          sql.onDialect({
            sqlite: () => "sqlite",
            pg: () => "pg",
            mysql: () => "mysql",
            mssql: () => "mssql",
            clickhouse: () => "clickhouse",
            duckdb: () => "duckdb"
          }),
          "duckdb"
        )
      }))

    it.effect("typed parameters and binary values", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        yield* sql`DROP TABLE IF EXISTS typed_test`
        yield* sql`CREATE TABLE typed_test (id INTEGER, values INTEGER[], bytes BLOB)`

        const bytes = Uint8Array.from([1, 2, 3])
        yield* sql`INSERT INTO typed_test VALUES (${1}, ${sql.typed([1, 2, 3], Duckdb.LIST(Duckdb.INTEGER))}, ${bytes})`

        const rows = yield* sql<{ id: number; values: ReadonlyArray<number>; bytes: Uint8Array }>`
          SELECT id, values, bytes FROM typed_test
        `
        assert.strictEqual(rows[0].id, 1)
        assert.deepStrictEqual(rows[0].values, [1, 2, 3])
        assert.deepStrictEqual(rows[0].bytes, bytes)
      }))

    it.effect("streams rows", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        const rows = yield* sql<{ value: number }>`SELECT range::INTEGER AS value FROM range(3)`.stream.pipe(
          Stream.runCollect
        )
        assert.deepStrictEqual(rows, [{ value: 0 }, { value: 1 }, { value: 2 }])
      }))

    it.effect("streaming is isolated from concurrent queries on the connection", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        // > 2048 rows so the result spans multiple DuckDB chunks.
        yield* sql`CREATE OR REPLACE TABLE stream_iso AS SELECT range::INTEGER AS value FROM range(3000)`

        let seen = 0
        let sum = 0
        // Run another query on the connection for every streamed row. With a
        // shared connection this either truncated the stream silently or
        // deadlocked; the dedicated stream connection makes it safe.
        yield* sql<{ value: number }>`SELECT value FROM stream_iso ORDER BY value`.stream.pipe(
          Stream.runForEach((row) =>
            Effect.gen(function*() {
              const echoed = yield* sql<{ c: number }>`SELECT ${row.value}::INTEGER AS c`
              seen++
              sum += echoed[0].c
            })
          )
        )

        assert.strictEqual(seen, 3000)
        assert.strictEqual(sum, (2999 * 3000) / 2)
      }))

    it.effect("binding an empty array fails with a clear, actionable error", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        const error = yield* Effect.flip(sql`SELECT ${[]} AS value`)
        assert.match(String((error.reason as any).cause?.message ?? (error.reason as any).cause), /empty array/i)
      }))

    it.effect("appender, scalar function, and table names", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        yield* sql`DROP TABLE IF EXISTS appender_test`
        yield* sql`CREATE TABLE appender_test (id INTEGER, name VARCHAR)`

        yield* Effect.scoped(
          Effect.gen(function*() {
            const appender = yield* sql.createAppender("appender_test")
            yield* Effect.sync(() => {
              appender.appendInteger(1)
              appender.appendVarchar("duck")
              appender.endRow()
            })
          })
        )

        const scalarFunction = Duckdb.DuckDBScalarFunction.create({
          name: "effect_add_one",
          parameterTypes: [Duckdb.INTEGER],
          returnType: Duckdb.INTEGER,
          mainFunction: (_info, input, output) => {
            const inputVector = input.getColumnVector(0)
            for (let i = 0; i < input.rowCount; i++) {
              output.setItem(i, (inputVector.getItem(i) as number) + 1)
            }
            output.flush()
          }
        })
        yield* sql.registerScalarFunction(scalarFunction)

        const rows = yield* sql<{ id: number; name: string; id2: number }>`
          SELECT id, name, effect_add_one(id) AS id2 FROM appender_test
        `
        assert.deepStrictEqual(rows, [{ id: 1, name: "duck", id2: 2 }])

        const names = yield* sql.getTableNames("SELECT * FROM appender_test")
        assert.deepStrictEqual(names, ["appender_test"])
      }))

    it.effect("scoped prepared statements", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        const rows = yield* Effect.scoped(
          Effect.gen(function*() {
            const prepared = yield* sql.prepare("SELECT $1::INTEGER AS value")
            prepared.bind([42])
            const reader = yield* Effect.tryPromise(() => prepared.runAndReadAll())
            return reader.getRowObjectsJS()
          })
        )
        assert.deepStrictEqual(rows, [{ value: 42 }])
      }))

    it.effect("classifies syntax and unique constraint errors", () =>
      Effect.gen(function*() {
        const sql = yield* setup("errors_test")

        const syntax = yield* Effect.flip(sql.unsafe("SELEC 1"))
        assert.strictEqual(syntax.reason._tag, "SqlSyntaxError")

        yield* sql`INSERT INTO errors_test (id, name) VALUES (${1}, ${"one"})`
        const duplicate = yield* Effect.flip(sql`INSERT INTO errors_test (id, name) VALUES (${1}, ${"two"})`)
        assert.strictEqual(duplicate.reason._tag, "UniqueViolation")
      }))
  })

  layer(DuckdbClient.layer({ resultMode: "json" }), { timeout: "30 seconds" })((it) => {
    it.effect("json result mode", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        const rows = yield* sql<{ value: string }>`SELECT 9223372036854775807::BIGINT AS value`
        assert.deepStrictEqual(rows, [{ value: "9223372036854775807" }])
      }))
  })

  layer(
    DuckdbClient.layer({
      transformQueryNames: (name) => name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
      transformResultNames: (name) => name.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("name transforms", () =>
      Effect.gen(function*() {
        const sql = yield* DuckdbClient.DuckdbClient
        yield* sql`CREATE TABLE ${sql("peopleTest")} (${sql("firstName")} VARCHAR)`
        yield* sql`INSERT INTO ${sql("peopleTest")} (${sql("firstName")}) VALUES (${"Tim"})`

        const rows = yield* sql<{ firstName: string }>`SELECT ${sql("firstName")} FROM ${sql("peopleTest")}`
        assert.deepStrictEqual(rows, [{ firstName: "Tim" }])
      }))
  })

  describe("constructors", () => {
    it.effect("fromInstance and fromConnection", () =>
      Effect.gen(function*() {
        const instance = yield* Effect.acquireRelease(
          Effect.tryPromise(() => Duckdb.DuckDBInstance.create()),
          (instance) => Effect.sync(() => instance.closeSync())
        )

        const fromInstance = yield* DuckdbClient.fromInstance({ liveInstance: instance })
        const rows1 = yield* fromInstance<{ value: number }>`SELECT 1 AS value`
        assert.deepStrictEqual(rows1, [{ value: 1 }])

        const connection = yield* Effect.acquireRelease(
          Effect.tryPromise(() => instance.connect()),
          (connection) => Effect.sync(() => connection.closeSync())
        )
        const fromConnection = yield* DuckdbClient.fromConnection({
          liveConnection: connection,
          liveInstance: instance
        })
        const rows2 = yield* fromConnection<{ value: number }>`SELECT 2 AS value`
        assert.deepStrictEqual(rows2, [{ value: 2 }])
      }).pipe(
        Effect.scoped,
        Effect.provide(Reactivity.layer)
      ))
  })
})
