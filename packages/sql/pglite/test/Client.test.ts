import { PgliteClient } from "@effect/sql-pglite"
import { assert, describe, layer } from "@effect/vitest"
import { Effect, Fiber, Layer, Stream } from "effect"
import * as TestClock from "effect/testing/TestClock"

const ClientLayer = PgliteClient.layer({})

const Migrations = Layer.effectDiscard(
  PgliteClient.PgliteClient.asEffect().pipe(
    Effect.andThen((sql) =>
      Effect.acquireRelease(
        sql`CREATE TABLE test (id SERIAL PRIMARY KEY, name TEXT)`,
        () => sql`DROP TABLE test`.pipe(Effect.ignore)
      )
    )
  )
)

describe("PgliteClient", () => {
  layer(ClientLayer, { timeout: "30 seconds" })((it) => {
    it.effect("basic insert/select", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        yield* sql`INSERT INTO test (name) VALUES ('hello')`
        const rows = yield* sql<{ id: number; name: string }>`SELECT * FROM test`
        assert.deepStrictEqual(rows, [{ id: 1, name: "hello" }])
        const values = yield* sql`SELECT * FROM test`.values
        assert.deepStrictEqual(values, [[1, "hello"]])
      }).pipe(Effect.provide(Migrations)))

    it.effect("insert helper", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const [query, params] = sql`INSERT INTO people ${sql.insert({ name: "Tim", age: 10 })}`.compile()
        assert.strictEqual(query, `INSERT INTO people ("name","age") VALUES ($1,$2)`)
        assert.deepStrictEqual(params, ["Tim", 10])
      }))

    it.effect("update helper", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const [query, params] = sql`UPDATE people SET ${sql.update({ name: "Tim" })}`.compile()
        assert.strictEqual(query, `UPDATE people SET "name" = $1`)
        assert.deepStrictEqual(params, ["Tim"])
      }))

    it.effect("updateValues helper", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const [query, params] = sql`UPDATE people SET name = data.name FROM ${
          sql.updateValues([{ name: "Tim" }, { name: "John" }], "data")
        }`.compile()
        assert.strictEqual(
          query,
          `UPDATE people SET name = data.name FROM (values ($1),($2)) AS data("name")`
        )
        assert.deepStrictEqual(params, ["Tim", "John"])
      }))

    it.effect("in helper", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const [query, params] = sql`SELECT * FROM ${sql("people")} WHERE id IN ${sql.in([1, 2, "x"])}`.compile()
        assert.strictEqual(query, `SELECT * FROM "people" WHERE id IN ($1,$2,$3)`)
        assert.deepStrictEqual(params, [1, 2, "x"])
      }))

    it.effect("and helper", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const now = new Date()
        const [query, params] = sql`SELECT * FROM ${sql("people")} WHERE ${
          sql.and([sql.in("name", ["Tim", "John"]), sql`created_at < ${now}`])
        }`.compile()
        assert.strictEqual(query, `SELECT * FROM "people" WHERE ("name" IN ($1,$2) AND created_at < $3)`)
        assert.deepStrictEqual(params, ["Tim", "John", now])
      }))

    it.effect("identifier transform", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const compiler = PgliteClient.makeCompiler((s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
        const [query] = compiler.compile(sql`SELECT * FROM ${sql("peopleTest")}`, false)
        assert.strictEqual(query, `SELECT * FROM "people_test"`)
      }))

    it.effect("json fragment", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const rows = yield* sql<{ json: unknown }>`SELECT ${sql.json({ a: 1 })}::jsonb AS json`
        assert.deepStrictEqual(rows[0].json, { a: 1 })
      }))

    it.effect("listen + notify", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        const fiber = yield* sql.listen("ch1").pipe(Stream.take(1), Stream.runCollect, Effect.forkScoped)
        yield* TestClock.adjust("250 millis")
        yield* sql.notify("ch1", "hello")
        const payloads = yield* Fiber.join(fiber)
        assert.deepStrictEqual(payloads, ["hello"])
      }), { timeout: 15_000 })

    it.effect("provider extras", () =>
      Effect.gen(function*() {
        const sql = yield* PgliteClient.PgliteClient
        yield* sql.refreshArrayTypes
        const dump = yield* sql.dumpDataDir("none")
        assert.isAbove((dump as Blob).size, 0)
      }))
  })

  describe("fromClient", () => {
    layer(
      Layer.unwrap(
        Effect.gen(function*() {
          const { PGlite } = yield* Effect.promise(() => import("@electric-sql/pglite"))
          const pg = new PGlite()
          yield* Effect.promise(() => pg.waitReady)
          return PgliteClient.layerFrom(PgliteClient.fromClient({ liveClient: pg }))
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("works", () =>
        Effect.gen(function*() {
          const sql = yield* PgliteClient.PgliteClient
          const rows = yield* sql<{ value: number }>`SELECT 1 AS value`
          assert.deepStrictEqual(rows, [{ value: 1 }])
        }))
    })
  })
})
