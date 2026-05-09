import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema, Stream } from "effect"
import { Reactivity } from "effect/unstable/reactivity"
import * as Model from "effect/unstable/schema/Model"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import * as SqlModel from "effect/unstable/sql/SqlModel"
import * as SqlResolver from "effect/unstable/sql/SqlResolver"
import * as Statement from "effect/unstable/sql/Statement"

class User extends Model.Class<User>("User")({
  id: Model.Generated(Schema.Number),
  name: Schema.String,
  deletedAt: Schema.NullOr(Schema.String)
}) {}

const makeClient = (
  captured: Array<{ readonly sql: string; readonly params: ReadonlyArray<unknown> }>,
  rows: ReadonlyArray<unknown> = [{ id: 1, name: "Grace", deletedAt: null }]
) =>
  SqlClient.make({
    acquirer: Effect.succeed({
      execute(sql, params) {
        return Effect.sync(() => {
          captured.push({ sql, params })
          return rows
        })
      },
      executeRaw(sql, params) {
        return Effect.sync(() => {
          captured.push({ sql, params })
          return rows
        })
      },
      executeStream(sql, params) {
        captured.push({ sql, params })
        return Stream.fromIterable(rows)
      },
      executeValues(sql, params) {
        return Effect.sync(() => {
          captured.push({ sql, params })
          return []
        })
      },
      executeUnprepared(sql, params) {
        return Effect.sync(() => {
          captured.push({ sql, params })
          return rows
        })
      }
    }),
    compiler: Statement.makeCompilerSqlite(),
    spanAttributes: []
  }).pipe(Effect.provide(Reactivity.layer))

const makeRepository = (client: SqlClient.SqlClient) =>
  SqlModel.makeRepository(User, {
    tableName: "users",
    spanPrefix: "User",
    idColumn: "id",
    softDeleteColumn: "deletedAt"
  }).pipe(Effect.provideService(SqlClient.SqlClient, client))

const makeResolvers = (client: SqlClient.SqlClient) =>
  SqlModel.makeResolvers(User, {
    tableName: "users",
    spanPrefix: "User",
    idColumn: "id",
    softDeleteColumn: "deletedAt"
  }).pipe(Effect.provideService(SqlClient.SqlClient, client))

describe("SqlModel", () => {
  describe("soft delete", () => {
    it.effect("omits the soft delete column from updates and ignores soft deleted rows", () =>
      Effect.gen(function*() {
        const captured: Array<{ readonly sql: string; readonly params: ReadonlyArray<unknown> }> = []
        const client = yield* makeClient(captured)
        const repository = yield* makeRepository(client)

        yield* repository.update({ id: 1, name: "Grace", deletedAt: "already-deleted" })

        assert.strictEqual(
          captured[0].sql,
          "update \"users\" set \"name\" = ? where (\"id\" = ? AND \"deletedAt\" is null) returning *"
        )
        assert.deepStrictEqual(captured[0].params, ["Grace", 1])
      }))

    it.effect("omits the soft delete column from void updates and ignores soft deleted rows", () =>
      Effect.gen(function*() {
        const captured: Array<{ readonly sql: string; readonly params: ReadonlyArray<unknown> }> = []
        const client = yield* makeClient(captured)
        const repository = yield* makeRepository(client)

        yield* repository.updateVoid({ id: 1, name: "Grace", deletedAt: "already-deleted" })

        assert.strictEqual(
          captured[0].sql,
          "update \"users\" set \"name\" = ? where (\"id\" = ? AND \"deletedAt\" is null)"
        )
        assert.deepStrictEqual(captured[0].params, ["Grace", 1])
      }))

    it.effect("soft deletes only rows that have not already been soft deleted", () =>
      Effect.gen(function*() {
        const captured: Array<{ readonly sql: string; readonly params: ReadonlyArray<unknown> }> = []
        const client = yield* makeClient(captured)
        const repository = yield* makeRepository(client)

        yield* repository.delete(1)

        assert.strictEqual(
          captured[0].sql,
          "update \"users\" set \"deletedAt\" = CURRENT_TIMESTAMP where (\"id\" = ? AND \"deletedAt\" is null)"
        )
        assert.deepStrictEqual(captured[0].params, [1])
      }))

    it.effect("resolver soft deletes only rows that have not already been soft deleted", () =>
      Effect.gen(function*() {
        const captured: Array<{ readonly sql: string; readonly params: ReadonlyArray<unknown> }> = []
        const client = yield* makeClient(captured)
        const resolvers = yield* makeResolvers(client)

        yield* SqlResolver.request(1, resolvers.delete)

        assert.strictEqual(
          captured[0].sql,
          "update \"users\" set \"deletedAt\" = CURRENT_TIMESTAMP where (\"id\" IN (?) AND \"deletedAt\" is null)"
        )
        assert.deepStrictEqual(captured[0].params, [1])
      }))
  })
})
