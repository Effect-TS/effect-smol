import { SqliteClient } from "@effect/sql-sqlite-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Queue } from "effect"
import * as Option from "effect/Option"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import type * as EventLogServerUnencrypted from "effect/unstable/eventlog/EventLogServerUnencrypted"
import * as SqlEventLogServerUnencrypted from "effect/unstable/eventlog/SqlEventLogServerUnencrypted"
import { Reactivity } from "effect/unstable/reactivity"
import * as SqlClient from "effect/unstable/sql/SqlClient"

const makeStorage = Effect.gen(function*() {
  const sql = yield* SqliteClient.make({ filename: ":memory:" })
  return yield* SqlEventLogServerUnencrypted.makeStorage().pipe(
    Effect.provideService(SqlClient.SqlClient, sql)
  )
}).pipe(Effect.provide(Reactivity.layer))

const makeEntry = (
  name: string,
  options: {
    readonly id?: EventJournal.EntryId | undefined
    readonly primaryKey?: string | undefined
  } = {}
) =>
  new EventJournal.Entry({
    id: options.id ?? EventJournal.makeEntryIdUnsafe(),
    event: "UserNameSet",
    primaryKey: options.primaryKey ?? "user-1",
    payload: new TextEncoder().encode(name)
  }, { disableChecks: true })

const storeA = "store-a" as EventLogServerUnencrypted.StoreId
const storeB = "store-b" as EventLogServerUnencrypted.StoreId

describe("SqlEventLogServerUnencrypted", () => {
  it.effect("persists remote id across storage instances", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const sql = yield* SqliteClient.make({ filename: ":memory:" })
        const storageA = yield* SqlEventLogServerUnencrypted.makeStorage().pipe(
          Effect.provideService(SqlClient.SqlClient, sql)
        )
        const storageB = yield* SqlEventLogServerUnencrypted.makeStorage().pipe(
          Effect.provideService(SqlClient.SqlClient, sql)
        )

        const idA = yield* storageA.getId
        const idB = yield* storageB.getId
        assert.deepStrictEqual(idA, idB)
      }).pipe(Effect.provide(Reactivity.layer))
    ))

  it.effect("deduplicates writes per store and keeps per-store sequences isolated", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* makeStorage
        const sharedId = EventJournal.makeEntryIdUnsafe()
        const entryA = makeEntry("Ada", { id: sharedId })
        const entryB = makeEntry("Grace")

        const first = yield* storage.write(storeA, [entryA, entryA, entryB])
        assert.deepStrictEqual(first.sequenceNumbers, [1, 1, 2])
        assert.deepStrictEqual(first.committed.map((entry) => entry.remoteSequence), [1, 2])

        const second = yield* storage.write(storeA, [entryB, entryA])
        assert.deepStrictEqual(second.sequenceNumbers, [2, 1])
        assert.deepStrictEqual(second.committed, [])

        const otherStore = yield* storage.write(storeB, [entryA])
        assert.deepStrictEqual(otherStore.sequenceNumbers, [1])
        assert.deepStrictEqual(otherStore.committed.map((entry) => entry.remoteSequence), [1])

        const stored = yield* storage.entries(storeA, 1)
        assert.deepStrictEqual(stored.map((entry) => entry.remoteSequence), [2])
        assert.strictEqual(stored[0].entry.idString, entryB.idString)
      })
    ))

  it.effect("replays backlog before streaming new changes", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* makeStorage
        const entryA = makeEntry("Ada")
        const entryB = makeEntry("Grace")
        const entryC = makeEntry("Margaret")

        yield* storage.write(storeA, [entryA, entryB])

        const changes = yield* storage.changes(storeA, 0)
        const initial = yield* Queue.takeAll(changes)
        assert.deepStrictEqual(initial.map((entry) => entry.remoteSequence), [1, 2])
        assert.deepStrictEqual(initial.map((entry) => entry.entry.idString), [entryA.idString, entryB.idString])

        const nextWrite = yield* storage.write(storeA, [entryC])
        assert.deepStrictEqual(nextWrite.sequenceNumbers, [3])

        const next = yield* Queue.take(changes)
        assert.strictEqual(next.remoteSequence, 3)
        assert.strictEqual(next.entry.idString, entryC.idString)
      })
    ))

  it.effect("reuses rolled back sequences and only publishes after the outer transaction commits", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* makeStorage
        const changes = yield* storage.changes(storeA, 0)
        const rolledBack = makeEntry("RolledBack")

        const exit = yield* storage.withTransaction(
          Effect.gen(function*() {
            yield* storage.write(storeA, [rolledBack])
            return yield* Effect.fail("boom")
          })
        ).pipe(Effect.exit)

        assert.strictEqual(Exit.isFailure(exit), true)
        assert.strictEqual(Option.isNone(yield* Queue.poll(changes)), true)
        assert.deepStrictEqual(yield* storage.entries(storeA, 0), [])

        const committed = makeEntry("Committed")
        const result = yield* storage.write(storeA, [committed])
        assert.deepStrictEqual(result.sequenceNumbers, [1])
        assert.deepStrictEqual(result.committed.map((entry) => entry.remoteSequence), [1])

        const next = yield* Queue.take(changes)
        assert.strictEqual(next.remoteSequence, 1)
        assert.strictEqual(next.entry.idString, committed.idString)
      })
    ))
})
