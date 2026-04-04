import { SqliteClient } from "@effect/sql-sqlite-do"
import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect } from "effect"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import { makeDurableObjectStorage } from "./utils.ts"

describe("Transaction", () => {
  it.effect("commit persists data", () =>
    Effect.gen(function*() {
      const { storage, close } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ storage })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`
      yield* Effect.gen(function*() {
        yield* sql`INSERT INTO users (name) VALUES (${"alice"})`
        yield* sql`INSERT INTO users (name) VALUES (${"bob"})`
      }).pipe(sql.withTransaction)

      const rows = yield* sql`SELECT * FROM users`
      assert.deepStrictEqual(rows, [
        { id: 1, name: "alice" },
        { id: 2, name: "bob" }
      ])
      close()
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))

  it.effect("rollback on failure discards all writes", () =>
    Effect.gen(function*() {
      const { storage, close } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ storage })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`
      yield* sql`INSERT INTO users (name) VALUES (${"pre-existing"})`

      yield* Effect.gen(function*() {
        yield* sql`INSERT INTO users (name) VALUES (${"alice"})`
        yield* sql`INSERT INTO users (name) VALUES (${"bob"})`
        return yield* Effect.fail("simulated failure")
      }).pipe(sql.withTransaction, Effect.ignore)

      const rows = yield* sql`SELECT * FROM users`
      assert.deepStrictEqual(rows, [{ id: 1, name: "pre-existing" }])
      close()
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))

  it.effect("rollback on defect discards writes", () =>
    Effect.gen(function*() {
      const { storage, close } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ storage })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`

      yield* Effect.gen(function*() {
        yield* sql`INSERT INTO users (name) VALUES (${"alice"})`
        return yield* Effect.die("unexpected defect")
      }).pipe(sql.withTransaction, Effect.sandbox, Effect.ignore)

      const rows = yield* sql`SELECT * FROM users`
      assert.deepStrictEqual(rows, [])
      close()
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))

  it.effect("nested withTransaction commits atomically", () =>
    Effect.gen(function*() {
      const { storage, close } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ storage })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`

      yield* Effect.gen(function*() {
        yield* sql`INSERT INTO users (name) VALUES (${"outer"})`
        yield* Effect.gen(function*() {
          yield* sql`INSERT INTO users (name) VALUES (${"inner"})`
        }).pipe(sql.withTransaction)
      }).pipe(sql.withTransaction)

      const rows = yield* sql`SELECT * FROM users`
      assert.deepStrictEqual(rows, [
        { id: 1, name: "outer" },
        { id: 2, name: "inner" }
      ])
      close()
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))

  it.effect("nested failure rolls back entire transaction", () =>
    Effect.gen(function*() {
      const { storage, close } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ storage })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`

      yield* Effect.gen(function*() {
        yield* sql`INSERT INTO users (name) VALUES (${"outer"})`
        yield* Effect.gen(function*() {
          yield* sql`INSERT INTO users (name) VALUES (${"inner"})`
          return yield* Effect.fail("inner failure")
        }).pipe(sql.withTransaction)
      }).pipe(sql.withTransaction, Effect.ignore)

      const rows = yield* sql`SELECT * FROM users`
      assert.deepStrictEqual(rows, [])
      close()
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))

  it.effect("can read own writes within transaction", () =>
    Effect.gen(function*() {
      const { storage, close } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ storage })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`

      yield* Effect.gen(function*() {
        yield* sql`INSERT INTO users (name) VALUES (${"alice"})`
        const rows = yield* sql`SELECT * FROM users`
        assert.deepStrictEqual(rows, [{ id: 1, name: "alice" }])

        yield* sql`INSERT INTO users (name) VALUES (${"bob"})`
        const rows2 = yield* sql`SELECT * FROM users`
        assert.deepStrictEqual(rows2, [
          { id: 1, name: "alice" },
          { id: 2, name: "bob" }
        ])
      }).pipe(sql.withTransaction)

      close()
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))

  it.effect("constraint violation triggers rollback", () =>
    Effect.gen(function*() {
      const { storage, close } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ storage })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`

      yield* Effect.gen(function*() {
        yield* sql`INSERT INTO users (name) VALUES (${"alice"})`
        yield* sql`INSERT INTO users (name) VALUES (${"alice"})`
      }).pipe(sql.withTransaction, Effect.ignore)

      const rows = yield* sql`SELECT * FROM users`
      assert.deepStrictEqual(rows, [])
      close()
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))

  it.effect("withTransaction without storage dies", () =>
    Effect.gen(function*() {
      const { storage } = makeDurableObjectStorage()
      const sql = yield* SqliteClient.make({ db: storage.sql })

      yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`
      const result = yield* sql`INSERT INTO users (name) VALUES (${"hello"})`.pipe(
        sql.withTransaction,
        Effect.sandbox,
        Effect.flip
      )
      assert.equal(Cause.hasDies(result), true)
    }).pipe(
      Effect.scoped,
      Effect.provide(Reactivity.layer)
    ))
})
