import { D1Client } from "@effect/sql-d1"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { Cause } from "effect/data"
import { D1Miniflare } from "./utils.ts"

describe("Client", () => {
  it.effect("should handle queries without transactions", () =>
    Effect.gen(function*() {
      const sql = yield* D1Client.D1Client
      yield* sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`
      yield* sql`INSERT INTO test (name) VALUES ('hello')`
      let rows = yield* sql`SELECT * FROM test`
      assert.deepStrictEqual(rows, [{ id: 1, name: "hello" }])
      yield* sql`INSERT INTO test (name) VALUES ('world')`
      rows = yield* sql`SELECT * FROM test`
      assert.deepStrictEqual(rows, [
        { id: 1, name: "hello" },
        { id: 2, name: "world" }
      ])
    }).pipe(Effect.provide(D1Miniflare.layerClient)))

  it.effect("should handle queries with params without transactions", () =>
    Effect.gen(function*() {
      const sql = yield* D1Client.D1Client
      yield* sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`
      yield* sql`INSERT INTO test ${sql.insert({ name: "hello" })}`
      const rows = yield* sql`SELECT * FROM test WHERE name = ${"hello"}`
      assert.deepStrictEqual(rows, [{ id: 1, name: "hello" }])
    }).pipe(Effect.provide(D1Miniflare.layerClient)))

  it.effect("should defect on transactions", () =>
    Effect.gen(function*() {
      const sql = yield* D1Client.D1Client
      yield* sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`
      const res = yield* sql`INSERT INTO test ${sql.insert({ name: "hello" })}`.pipe(
        sql.withTransaction,
        Effect.sandbox,
        Effect.flip
      )
      const rows = yield* sql`SELECT * FROM test`
      assert.deepStrictEqual(rows, [])
      assert.equal(Cause.hasDie(res), true)
    }).pipe(Effect.provide(D1Miniflare.layerClient)))
})
