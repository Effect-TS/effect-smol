import { assert, describe, it } from "@effect/vitest"
import { Effect, Queue } from "effect"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLogServerUnencrypted from "effect/unstable/eventlog/EventLogServerUnencrypted"

const makeEntry = (primaryKey: string): EventJournal.Entry =>
  new EventJournal.Entry({
    id: EventJournal.makeEntryIdUnsafe(),
    event: "UserUpdated",
    primaryKey,
    payload: new Uint8Array([1, 2, 3])
  })

describe("EventLogServerUnencrypted", () => {
  it.effect("uses one store-scoped sequence space for shared-store history", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.Storage
        const storeId = "store-1" as EventLogServerUnencrypted.StoreId

        const fromFirstPublicKey = yield* storage.write(storeId, [makeEntry("user-1")])
        const fromSecondPublicKey = yield* storage.write(storeId, [makeEntry("user-2")])

        assert.deepStrictEqual(fromFirstPublicKey.sequenceNumbers, [1])
        assert.deepStrictEqual(fromSecondPublicKey.sequenceNumbers, [2])

        const backlogFromStart = yield* storage.entries(storeId, 0)
        assert.deepStrictEqual(backlogFromStart.map((entry) => entry.remoteSequence), [1, 2])

        const fromCursor = yield* storage.entries(storeId, 1)
        assert.deepStrictEqual(fromCursor.map((entry) => entry.remoteSequence), [2])

        const changes = yield* storage.changes(storeId, 1)
        const queuedBacklog = yield* Queue.take(changes)
        assert.strictEqual(queuedBacklog.remoteSequence, 2)

        const liveWrite = yield* storage.write(storeId, [makeEntry("user-3")])
        assert.deepStrictEqual(liveWrite.sequenceNumbers, [3])

        const live = yield* Queue.take(changes)
        assert.strictEqual(live.remoteSequence, 3)
      }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory))
    ))

  it.effect("deduplicates per store while preserving one ack sequence per submitted entry", () =>
    Effect.gen(function*() {
      const storage = yield* EventLogServerUnencrypted.Storage
      const storeA = "store-a" as EventLogServerUnencrypted.StoreId
      const storeB = "store-b" as EventLogServerUnencrypted.StoreId
      const duplicate = makeEntry("same-entry")

      const firstBatch = yield* storage.write(storeA, [duplicate, duplicate])
      assert.deepStrictEqual(firstBatch.sequenceNumbers, [1, 1])
      assert.deepStrictEqual(firstBatch.committed.map((entry) => entry.remoteSequence), [1])

      const existingDuplicate = yield* storage.write(storeA, [duplicate])
      assert.deepStrictEqual(existingDuplicate.sequenceNumbers, [1])
      assert.strictEqual(existingDuplicate.committed.length, 0)

      const mixedBatch = yield* storage.write(storeA, [makeEntry("next"), duplicate, makeEntry("other")])
      assert.deepStrictEqual(mixedBatch.sequenceNumbers, [2, 1, 3])
      assert.deepStrictEqual(mixedBatch.committed.map((entry) => entry.remoteSequence), [2, 3])

      const differentStore = yield* storage.write(storeB, [duplicate])
      assert.deepStrictEqual(differentStore.sequenceNumbers, [1])
      assert.deepStrictEqual(differentStore.committed.map((entry) => entry.remoteSequence), [1])

      const storeAEntries = yield* storage.entries(storeA, 0)
      assert.deepStrictEqual(storeAEntries.map((entry) => entry.remoteSequence), [1, 2, 3])

      const storeBEntries = yield* storage.entries(storeB, 0)
      assert.deepStrictEqual(storeBEntries.map((entry) => entry.remoteSequence), [1])
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory)))
})
