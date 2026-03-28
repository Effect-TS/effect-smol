import { assert, it } from "@effect/vitest"
import { Effect, Exit, Fiber, Layer, Option, Queue } from "effect"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import type * as EventLogServerUnencrypted from "effect/unstable/eventlog/EventLogServerUnencrypted"
import * as SqlEventLogServerUnencrypted from "effect/unstable/eventlog/SqlEventLogServerUnencrypted"
import { Reactivity } from "effect/unstable/reactivity"
import type * as SqlClient from "effect/unstable/sql/SqlClient"

let nextNamespace = 0

const uniqueNamespace = (prefix: string) => `${prefix}_${++nextNamespace}`

const makeOptions = (prefix: string) => {
  const namespace = uniqueNamespace(prefix)
  return {
    entryTablePrefix: `effect_events_${namespace}`,
    remoteIdTable: `effect_remote_id_${namespace}`,
    insertBatchSize: 2
  }
}

const makeStoreId = (prefix: string) => `${uniqueNamespace(prefix)}_store` as EventLogServerUnencrypted.StoreId

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

const makeStorage = (options: {
  readonly entryTablePrefix?: string
  readonly remoteIdTable?: string
  readonly insertBatchSize?: number
}) =>
  SqlEventLogServerUnencrypted.makeStorage(options).pipe(
    Effect.orDie
  )

export const suite = (name: string, layer: Layer.Layer<SqlClient.SqlClient, unknown>) =>
  it.layer(
    Layer.mergeAll(Reactivity.layer, layer),
    { timeout: "30 seconds" }
  )(`SqlEventLogServerUnencrypted (${name})`, (it) => {
    it.effect("persists remote id across storage instances", () =>
      Effect.gen(function*() {
        const options = makeOptions("remote_id")
        const storageA = yield* makeStorage(options)
        const storageB = yield* makeStorage(options)

        const idA = yield* storageA.getId
        const idB = yield* storageB.getId

        assert.deepStrictEqual(idA, idB)
      }))

    it.effect("keeps per-store sequence counters independent", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("per_store_sequences"))
        const storeA = makeStoreId("sequence_a")
        const storeB = makeStoreId("sequence_b")
        const entryA1 = makeEntry("Ada")
        const entryA2 = makeEntry("Grace")
        const entryB1 = makeEntry("Margaret")

        const firstA = yield* storage.write(storeA, [entryA1])
        const firstB = yield* storage.write(storeB, [entryB1])
        const secondA = yield* storage.write(storeA, [entryA2])

        assert.deepStrictEqual(firstA.sequenceNumbers, [1])
        assert.deepStrictEqual(firstB.sequenceNumbers, [1])
        assert.deepStrictEqual(secondA.sequenceNumbers, [2])
        assert.deepStrictEqual((yield* storage.entries(storeA, 0)).map((entry) => entry.remoteSequence), [1, 2])
        assert.deepStrictEqual((yield* storage.entries(storeB, 0)).map((entry) => entry.remoteSequence), [1])
      }))

    it.effect("deduplicates writes within one call and across repeated calls", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("idempotent_writes"))
        const storeId = makeStoreId("idempotent")
        const sharedId = EventJournal.makeEntryIdUnsafe()
        const entryA = makeEntry("Ada", { id: sharedId })
        const entryB = makeEntry("Grace")

        const first = yield* storage.write(storeId, [entryA, entryA, entryB, entryA])
        const second = yield* storage.write(storeId, [entryB, entryA, entryB])

        assert.deepStrictEqual(first.sequenceNumbers, [1, 1, 2, 1])
        assert.deepStrictEqual(first.committed.map((entry) => entry.remoteSequence), [1, 2])
        assert.deepStrictEqual(second.sequenceNumbers, [2, 1, 2])
        assert.deepStrictEqual(second.committed, [])
        assert.deepStrictEqual((yield* storage.entries(storeId, 0)).map((entry) => entry.remoteSequence), [1, 2])
      }))

    it.effect("uses strict > semantics for entries", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("entries_strict_gt"))
        const storeId = makeStoreId("entries")
        const missingStoreId = makeStoreId("entries_missing")
        const entryA = makeEntry("Ada")
        const entryB = makeEntry("Grace")
        const entryC = makeEntry("Margaret")

        yield* storage.write(storeId, [entryA, entryB, entryC])

        assert.deepStrictEqual((yield* storage.entries(storeId, 0)).map((entry) => entry.remoteSequence), [1, 2, 3])
        assert.deepStrictEqual((yield* storage.entries(storeId, 1)).map((entry) => entry.remoteSequence), [2, 3])
        assert.deepStrictEqual((yield* storage.entries(storeId, 3)).map((entry) => entry.remoteSequence), [])
        assert.deepStrictEqual(yield* storage.entries(missingStoreId, 0), [])
      }))

    it.effect("replays backlog and then streams live changes without startup duplication", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("changes_backlog_then_live"))
        const storeId = makeStoreId("changes")
        const entryA = makeEntry("Ada")
        const entryB = makeEntry("Grace")
        const entryC = makeEntry("Margaret")

        yield* storage.write(storeId, [entryA, entryB])

        const changes = yield* storage.changes(storeId, 0)
        const replayed = yield* Queue.takeAll(changes)

        assert.deepStrictEqual(replayed.map((entry) => entry.remoteSequence), [1, 2])
        assert.deepStrictEqual(replayed.map((entry) => entry.entry.idString), [entryA.idString, entryB.idString])

        yield* storage.write(storeId, [entryC])

        const next = yield* Queue.take(changes)
        assert.strictEqual(next.remoteSequence, 3)
        assert.strictEqual(next.entry.idString, entryC.idString)

        yield* Effect.yieldNow
        assert.strictEqual(Option.isNone(yield* Queue.poll(changes)), true)
      }))

    it.effect("handles the changes startup race without losing or duplicating rows", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("changes_startup_race"))

        for (let iteration = 0; iteration < 5; iteration++) {
          const storeId = makeStoreId(`startup_race_${iteration}`)
          const backlogEntry = makeEntry(`Ada_${iteration}`)
          const racedEntry = makeEntry(`Grace_${iteration}`)

          yield* storage.write(storeId, [backlogEntry])

          const changesFiber = yield* storage.changes(storeId, 0).pipe(Effect.forkScoped)
          yield* storage.write(storeId, [racedEntry])
          const changes = yield* Fiber.join(changesFiber)

          const first = yield* Queue.take(changes)
          const second = yield* Queue.take(changes)

          assert.deepStrictEqual(
            [first.remoteSequence, second.remoteSequence],
            [1, 2],
            `iteration ${iteration} should deliver exactly the backlog row and the raced row`
          )
          assert.deepStrictEqual(
            [first.entry.idString, second.entry.idString],
            [backlogEntry.idString, racedEntry.idString]
          )

          yield* Effect.yieldNow
          assert.strictEqual(Option.isNone(yield* Queue.poll(changes)), true)
        }
      }))

    it.effect("commits and rolls back transactions, reusing sequences after rollback", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("transactions"))
        const storeId = makeStoreId("transactions")
        const changes = yield* storage.changes(storeId, 0)
        const committedEntry = makeEntry("Committed")

        const committed = yield* storage.withTransaction(
          Effect.gen(function*() {
            const written = yield* storage.write(storeId, [committedEntry])

            assert.deepStrictEqual(written.sequenceNumbers, [1])
            assert.deepStrictEqual(written.committed.map((entry) => entry.remoteSequence), [1])
            assert.strictEqual(Option.isNone(yield* Queue.poll(changes)), true)

            return written
          })
        )

        assert.deepStrictEqual(committed.sequenceNumbers, [1])
        const firstDelivered = yield* Queue.take(changes)
        assert.strictEqual(firstDelivered.remoteSequence, 1)
        assert.strictEqual(firstDelivered.entry.idString, committedEntry.idString)

        const rolledBackEntry = makeEntry("RolledBack")
        const rolledBack = yield* storage.withTransaction(
          Effect.gen(function*() {
            const written = yield* storage.write(storeId, [rolledBackEntry])

            assert.deepStrictEqual(written.sequenceNumbers, [2])
            assert.strictEqual(Option.isNone(yield* Queue.poll(changes)), true)

            return yield* Effect.fail("boom")
          })
        ).pipe(Effect.exit)

        assert.strictEqual(Exit.isFailure(rolledBack), true)
        assert.deepStrictEqual((yield* storage.entries(storeId, 1)).map((entry) => entry.remoteSequence), [])
        assert.strictEqual(Option.isNone(yield* Queue.poll(changes)), true)

        const afterRollbackEntry = makeEntry("AfterRollback")
        const afterRollback = yield* storage.write(storeId, [afterRollbackEntry])

        assert.deepStrictEqual(afterRollback.sequenceNumbers, [2])
        assert.deepStrictEqual(afterRollback.committed.map((entry) => entry.remoteSequence), [2])

        const secondDelivered = yield* Queue.take(changes)
        assert.strictEqual(secondDelivered.remoteSequence, 2)
        assert.strictEqual(secondDelivered.entry.idString, afterRollbackEntry.idString)
      }))

    it.effect("isolates reads and streams between stores", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("store_isolation"))
        const storeA = makeStoreId("isolation_a")
        const storeB = makeStoreId("isolation_b")
        const entryA1 = makeEntry("Ada")
        const entryB1 = makeEntry("Grace")
        const entryA2 = makeEntry("Margaret")
        const entryB2 = makeEntry("Linus")

        yield* storage.write(storeA, [entryA1])
        yield* storage.write(storeB, [entryB1])

        assert.deepStrictEqual((yield* storage.entries(storeA, 0)).map((entry) => entry.entry.idString), [
          entryA1.idString
        ])
        assert.deepStrictEqual((yield* storage.entries(storeB, 0)).map((entry) => entry.entry.idString), [
          entryB1.idString
        ])

        const changesA = yield* storage.changes(storeA, 0)
        const backlogA = yield* Queue.takeAll(changesA)
        assert.deepStrictEqual(backlogA.map((entry) => entry.entry.idString), [entryA1.idString])

        yield* storage.write(storeB, [entryB2])
        yield* Effect.yieldNow
        assert.strictEqual(Option.isNone(yield* Queue.poll(changesA)), true)

        yield* storage.write(storeA, [entryA2])
        const nextA = yield* Queue.take(changesA)

        assert.strictEqual(nextA.remoteSequence, 2)
        assert.strictEqual(nextA.entry.idString, entryA2.idString)
      }))

    it.effect("allows the same EntryId to be committed in different stores", () =>
      Effect.gen(function*() {
        const storage = yield* makeStorage(makeOptions("shared_entry_id"))
        const storeA = makeStoreId("shared_id_a")
        const storeB = makeStoreId("shared_id_b")
        const sharedId = EventJournal.makeEntryIdUnsafe()
        const entryA = makeEntry("Ada", { id: sharedId, primaryKey: "user-a" })
        const entryB = makeEntry("Grace", { id: sharedId, primaryKey: "user-b" })

        const writtenA = yield* storage.write(storeA, [entryA])
        const writtenB = yield* storage.write(storeB, [entryB])

        assert.deepStrictEqual(writtenA.sequenceNumbers, [1])
        assert.deepStrictEqual(writtenB.sequenceNumbers, [1])
        assert.deepStrictEqual(writtenA.committed.map((entry) => entry.remoteSequence), [1])
        assert.deepStrictEqual(writtenB.committed.map((entry) => entry.remoteSequence), [1])
        assert.strictEqual((yield* storage.entries(storeA, 0))[0]?.entry.idString, entryA.idString)
        assert.strictEqual((yield* storage.entries(storeB, 0))[0]?.entry.idString, entryB.idString)
      }))
  })
