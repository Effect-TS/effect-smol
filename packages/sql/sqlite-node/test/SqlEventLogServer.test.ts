import { SqliteClient } from "@effect/sql-sqlite-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Queue } from "effect"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import type * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogEncryption from "effect/unstable/eventlog/EventLogEncryption"
import * as EventLogServer from "effect/unstable/eventlog/EventLogServer"
import * as SqlEventLogServer from "effect/unstable/eventlog/SqlEventLogServer"
import { Reactivity } from "effect/unstable/reactivity"
import * as SqlClient from "effect/unstable/sql/SqlClient"

const storeIdA = "store-a" as EventLog.StoreId
const storeIdB = "store-b" as EventLog.StoreId

const makeEntry = (value: number) =>
  new EventJournal.Entry({
    id: EventJournal.makeEntryIdUnsafe(),
    event: "UserCreated",
    primaryKey: `user-${value}`,
    payload: new Uint8Array([value])
  }, { disableChecks: true })

const persistEntries = (
  encryption: EventLogEncryption.EventLogEncryption["Service"],
  identity: EventLog.Identity["Service"],
  entries: ReadonlyArray<EventJournal.Entry>
) =>
  Effect.gen(function*() {
    const encrypted = yield* encryption.encrypt(identity, entries)
    return encrypted.encryptedEntries.map((encryptedEntry, index) =>
      new EventLogServer.PersistedEntry({
        entryId: entries[index].id,
        iv: encrypted.iv,
        encryptedEntry
      })
    )
  })

const makePersistedEntry = (index: number, entryId = EventJournal.makeEntryIdUnsafe()) =>
  new EventLogServer.PersistedEntry({
    entryId,
    iv: new Uint8Array(12),
    encryptedEntry: Uint8Array.of(index)
  })

describe("SqlEventLogServer", () => {
  it.effect("persists remote id across storage instances", () =>
    Effect.gen(function*() {
      const sql = yield* SqliteClient.make({ filename: ":memory:" })
      const storageA = yield* SqlEventLogServer.makeStorage().pipe(
        Effect.provideService(SqlClient.SqlClient, sql)
      )
      const storageB = yield* SqlEventLogServer.makeStorage().pipe(
        Effect.provideService(SqlClient.SqlClient, sql)
      )
      const idA = yield* storageA.getId
      const idB = yield* storageB.getId
      assert.deepStrictEqual(idA, idB)
    }).pipe(Effect.provide([Reactivity.layer, EventLogEncryption.layerSubtle])))

  it.effect("writes entries and streams changes", () =>
    Effect.gen(function*() {
      const sql = yield* SqliteClient.make({ filename: ":memory:" })
      const storage = yield* SqlEventLogServer.makeStorage().pipe(
        Effect.provideService(SqlClient.SqlClient, sql)
      )
      const encryption = yield* EventLogEncryption.EventLogEncryption
      const identity = yield* encryption.generateIdentity
      const entries = [makeEntry(1), makeEntry(2)]
      const persisted = yield* persistEntries(encryption, identity, entries)
      const written = yield* storage.write(identity.publicKey, storeIdA, persisted)
      assert.deepStrictEqual(written.map((entry) => entry.sequence), [1, 2])

      const stored = yield* storage.entries(identity.publicKey, storeIdA, 0)
      assert.deepStrictEqual(stored.map((entry) => entry.sequence), [1, 2])

      const changes = yield* storage.changes(identity.publicKey, storeIdA, 0)
      const initial = yield* Queue.takeAll(changes)
      assert.deepStrictEqual(initial.map((entry) => entry.sequence), [1, 2])

      const nextEntry = makeEntry(3)
      const nextPersisted = yield* persistEntries(encryption, identity, [nextEntry])
      const updated = yield* storage.write(identity.publicKey, storeIdA, nextPersisted)
      assert.deepStrictEqual(updated.map((entry) => entry.sequence), [3])

      const next = yield* Queue.take(changes)
      assert.strictEqual(next.sequence, 3)
    }).pipe(Effect.provide([Reactivity.layer, EventLogEncryption.layerSubtle])))

  it.effect("isolates same publicKey across storeIds", () =>
    Effect.gen(function*() {
      const sql = yield* SqliteClient.make({ filename: ":memory:" })
      const storage = yield* SqlEventLogServer.makeStorage().pipe(
        Effect.provideService(SqlClient.SqlClient, sql)
      )

      yield* storage.write("client-1", storeIdA, [makePersistedEntry(1)])
      yield* storage.write("client-1", storeIdB, [makePersistedEntry(2)])

      const storeAEntries = yield* storage.entries("client-1", storeIdA, 0)
      const storeBEntries = yield* storage.entries("client-1", storeIdB, 0)

      assert.deepStrictEqual(storeAEntries.map((entry) => entry.sequence), [1])
      assert.deepStrictEqual(storeBEntries.map((entry) => entry.sequence), [1])
    }).pipe(Effect.provide([Reactivity.layer, EventLogEncryption.layerSubtle])))

  it.effect("isolates same storeId across publicKeys", () =>
    Effect.gen(function*() {
      const sql = yield* SqliteClient.make({ filename: ":memory:" })
      const storage = yield* SqlEventLogServer.makeStorage().pipe(
        Effect.provideService(SqlClient.SqlClient, sql)
      )

      yield* storage.write("client-1", storeIdA, [makePersistedEntry(1)])
      yield* storage.write("client-2", storeIdA, [makePersistedEntry(2)])

      const clientOneEntries = yield* storage.entries("client-1", storeIdA, 0)
      const clientTwoEntries = yield* storage.entries("client-2", storeIdA, 0)

      assert.deepStrictEqual(clientOneEntries.map((entry) => entry.sequence), [1])
      assert.deepStrictEqual(clientTwoEntries.map((entry) => entry.sequence), [1])
    }).pipe(Effect.provide([Reactivity.layer, EventLogEncryption.layerSubtle])))

  it.effect("keeps deduplication isolated per encrypted scope", () =>
    Effect.gen(function*() {
      const sql = yield* SqliteClient.make({ filename: ":memory:" })
      const storage = yield* SqlEventLogServer.makeStorage().pipe(
        Effect.provideService(SqlClient.SqlClient, sql)
      )
      const sharedEntryId = EventJournal.makeEntryIdUnsafe()

      yield* storage.write("client-1", storeIdA, [makePersistedEntry(1, sharedEntryId)])
      yield* storage.write("client-1", storeIdA, [makePersistedEntry(2, sharedEntryId)])
      yield* storage.write("client-1", storeIdB, [makePersistedEntry(3, sharedEntryId)])
      yield* storage.write("client-2", storeIdA, [makePersistedEntry(4, sharedEntryId)])

      assert.deepStrictEqual((yield* storage.entries("client-1", storeIdA, 0)).map((entry) => entry.sequence), [1])
      assert.deepStrictEqual((yield* storage.entries("client-1", storeIdB, 0)).map((entry) => entry.sequence), [1])
      assert.deepStrictEqual((yield* storage.entries("client-2", storeIdA, 0)).map((entry) => entry.sequence), [1])
    }).pipe(Effect.provide([Reactivity.layer, EventLogEncryption.layerSubtle])))
})
