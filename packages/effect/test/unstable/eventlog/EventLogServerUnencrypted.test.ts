import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Queue, Ref, Schema } from "effect"
import * as EventGroup from "effect/unstable/eventlog/EventGroup"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogServerUnencrypted from "effect/unstable/eventlog/EventLogServerUnencrypted"
import { Persistence } from "effect/unstable/persistence"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"

const UserPayload = Schema.Struct({
  id: Schema.String
})

const UserGroup = EventGroup.empty.add({
  tag: "UserCreated",
  primaryKey: (payload) => payload.id,
  payload: UserPayload
})

const schema = EventLog.schema(UserGroup)

const layerAuthAllowAll = Layer.succeed(
  EventLogServerUnencrypted.EventLogServerAuth,
  EventLogServerUnencrypted.EventLogServerAuth.of({
    authorizeWrite: () => Effect.void,
    authorizeRead: () => Effect.void
  })
)

const handlerLayer = (handled: Ref.Ref<ReadonlyArray<string>>) =>
  EventLog.group(
    UserGroup,
    (handlers) =>
      handlers.handle("UserCreated", ({ payload }) => Ref.update(handled, (values) => [...values, payload.id]))
  )

const runtimeLayer = (handled: Ref.Ref<ReadonlyArray<string>>) =>
  EventLogServerUnencrypted.layer(schema).pipe(
    Layer.provideMerge(EventJournal.layerMemory),
    Layer.provideMerge(EventLogServerUnencrypted.layerStorageMemory),
    Layer.provideMerge(EventLogServerUnencrypted.layerStoreMappingMemory),
    Layer.provideMerge(layerAuthAllowAll),
    Layer.provideMerge(handlerLayer(handled))
  )

const makeUserCreatedEntry = (id: string): Effect.Effect<EventJournal.Entry> =>
  Effect.gen(function*() {
    const payload = yield* Schema.encodeUnknownEffect(UserGroup.events.UserCreated.payloadMsgPack)({ id }).pipe(
      Effect.orDie
    )
    return new EventJournal.Entry({
      id: EventJournal.makeEntryIdUnsafe(),
      event: "UserCreated",
      primaryKey: id,
      payload
    }, { disableChecks: true })
  })

const makeEntry = (primaryKey: string): EventJournal.Entry =>
  new EventJournal.Entry({
    id: EventJournal.makeEntryIdUnsafe(),
    event: "UserUpdated",
    primaryKey,
    payload: new Uint8Array([1, 2, 3])
  })

describe("EventLogServerUnencrypted", () => {
  it.effect("accepted ingest runs handlers", () =>
    Effect.gen(function*() {
      const handled = yield* Ref.make<ReadonlyArray<string>>([])

      yield* Effect.gen(function*() {
        const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
        const mapping = yield* EventLogServerUnencrypted.StoreMapping
        const storeId = "store-runtime-handler" as EventLogServerUnencrypted.StoreId

        yield* mapping.assign({
          publicKey: "public-key-handler",
          storeId
        })

        const entry = yield* makeUserCreatedEntry("user-1")
        const result = yield* runtime.ingest({
          publicKey: "public-key-handler",
          entries: [entry]
        })

        assert.strictEqual(result.storeId, storeId)
        assert.deepStrictEqual(result.sequenceNumbers, [1])
        assert.deepStrictEqual(result.committed.map((entry) => entry.remoteSequence), [1])

        const seen = yield* Ref.get(handled)
        assert.deepStrictEqual(seen, ["user-1"])
      }).pipe(Effect.provide(runtimeLayer(handled)))
    }))

  it.effect("accepted ingest triggers Reactivity invalidation", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])
        const invalidations = yield* Ref.make(0)

        const runtimeLayerWithReactivity = Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
          EventLogServerUnencrypted.make
        ).pipe(
          Layer.provideMerge(EventJournal.layerMemory),
          Layer.provideMerge(EventLogServerUnencrypted.layerStorageMemory),
          Layer.provideMerge(EventLogServerUnencrypted.layerStoreMappingMemory),
          Layer.provideMerge(layerAuthAllowAll),
          Layer.provideMerge(handlerLayer(handled)),
          Layer.provideMerge(Reactivity.layer)
        )

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const reactivity = yield* Reactivity.Reactivity

          yield* mapping.assign({
            publicKey: "public-key-reactivity",
            storeId: "store-reactivity" as EventLogServerUnencrypted.StoreId
          })
          yield* runtime.registerReactivity({
            UserCreated: ["users"]
          })

          const query = yield* reactivity.query(
            { users: ["user-1"] },
            Ref.updateAndGet(invalidations, (count) => count + 1)
          )

          const initial = yield* Queue.take(query)
          assert.strictEqual(initial, 1)

          const entry = yield* makeUserCreatedEntry("user-1")
          yield* runtime.ingest({
            publicKey: "public-key-reactivity",
            entries: [entry]
          })

          const afterIngest = yield* Queue.take(query)
          assert.strictEqual(afterIngest, 2)

          const seen = yield* Ref.get(handled)
          assert.deepStrictEqual(seen, ["user-1"])
        }).pipe(Effect.provide(runtimeLayerWithReactivity))
      })
    ))

  it.effect("two keys mapped to one store observe one combined feed with shared sequence space", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const storeId = "store-shared-feed" as EventLogServerUnencrypted.StoreId

          yield* mapping.assign({ publicKey: "public-key-a", storeId })
          yield* mapping.assign({ publicKey: "public-key-b", storeId })

          const entryA = yield* makeUserCreatedEntry("user-a")
          const entryB = yield* makeUserCreatedEntry("user-b")

          const ingestA = yield* runtime.ingest({
            publicKey: "public-key-a",
            entries: [entryA]
          })
          const ingestB = yield* runtime.ingest({
            publicKey: "public-key-b",
            entries: [entryB]
          })

          assert.deepStrictEqual(ingestA.sequenceNumbers, [1])
          assert.deepStrictEqual(ingestB.sequenceNumbers, [2])

          const changesA = yield* runtime.requestChanges("public-key-a", 0)
          const firstForA = yield* Queue.take(changesA)
          const secondForA = yield* Queue.take(changesA)
          assert.deepStrictEqual(
            [firstForA.remoteSequence, secondForA.remoteSequence],
            [1, 2]
          )

          const changesB = yield* runtime.requestChanges("public-key-b", 0)
          const firstForB = yield* Queue.take(changesB)
          const secondForB = yield* Queue.take(changesB)
          assert.deepStrictEqual(
            [firstForB.remoteSequence, secondForB.remoteSequence],
            [1, 2]
          )

          assert.deepStrictEqual(
            [firstForA.entry.primaryKey, secondForA.entry.primaryKey],
            ["user-a", "user-b"]
          )
          assert.deepStrictEqual(
            [firstForB.entry.primaryKey, secondForB.entry.primaryKey],
            ["user-a", "user-b"]
          )
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("different stores replay independently even with overlapping sequence numbers", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping

          yield* mapping.assign({
            publicKey: "public-key-store-a",
            storeId: "store-a" as EventLogServerUnencrypted.StoreId
          })
          yield* mapping.assign({
            publicKey: "public-key-store-b",
            storeId: "store-b" as EventLogServerUnencrypted.StoreId
          })

          const ingestA = yield* runtime.ingest({
            publicKey: "public-key-store-a",
            entries: [yield* makeUserCreatedEntry("user-a")]
          })
          const ingestB = yield* runtime.ingest({
            publicKey: "public-key-store-b",
            entries: [yield* makeUserCreatedEntry("user-b")]
          })

          assert.deepStrictEqual(ingestA.sequenceNumbers, [1])
          assert.deepStrictEqual(ingestB.sequenceNumbers, [1])

          const seen = yield* Ref.get(handled)
          assert.deepStrictEqual(seen, ["user-a", "user-b"])
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("store mapping memory resolves, supports shared stores, and supports reassignment", () =>
    Effect.gen(function*() {
      const mapping = yield* EventLogServerUnencrypted.StoreMapping
      const storeA = "store-a" as EventLogServerUnencrypted.StoreId
      const storeB = "store-b" as EventLogServerUnencrypted.StoreId

      yield* mapping.assign({
        publicKey: "public-key-1",
        storeId: storeA
      })
      yield* mapping.assign({
        publicKey: "public-key-2",
        storeId: storeA
      })

      const resolvedOne = yield* mapping.resolve("public-key-1")
      const resolvedTwo = yield* mapping.resolve("public-key-2")
      assert.strictEqual(resolvedOne, storeA)
      assert.strictEqual(resolvedTwo, storeA)

      yield* mapping.assign({
        publicKey: "public-key-1",
        storeId: storeB
      })

      const reassigned = yield* mapping.resolve("public-key-1")
      assert.strictEqual(reassigned, storeB)
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStoreMappingMemory)))

  it.effect("store mapping resolve fails with NotFound for unknown public keys", () =>
    Effect.gen(function*() {
      const mapping = yield* EventLogServerUnencrypted.StoreMapping

      const error = yield* Effect.flip(mapping.resolve("missing-public-key"))
      assert.instanceOf(error, EventLogServerUnencrypted.EventLogServerStoreError)
      assert.strictEqual(error.reason, "NotFound")
      assert.strictEqual(error.publicKey, "missing-public-key")
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStoreMappingMemory)))

  it.effect("store mapping persisted survives service recreation", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const persistedStoreId = "eventlog-server-unencrypted-store-mapping-test"

        const mappingV1 = yield* EventLogServerUnencrypted.makeStoreMappingPersisted({
          storeId: persistedStoreId
        })

        const firstStore = "shared-store" as EventLogServerUnencrypted.StoreId
        const secondStore = "reassigned-store" as EventLogServerUnencrypted.StoreId

        yield* mappingV1.assign({
          publicKey: "persistent-public-key",
          storeId: firstStore
        })

        const fromFirstService = yield* mappingV1.resolve("persistent-public-key")
        assert.strictEqual(fromFirstService, firstStore)

        const mappingV2 = yield* EventLogServerUnencrypted.makeStoreMappingPersisted({
          storeId: persistedStoreId
        })

        const fromSecondService = yield* mappingV2.resolve("persistent-public-key")
        assert.strictEqual(fromSecondService, firstStore)

        yield* mappingV2.assign({
          publicKey: "persistent-public-key",
          storeId: secondStore
        })

        const mappingV3 = yield* EventLogServerUnencrypted.makeStoreMappingPersisted({
          storeId: persistedStoreId
        })

        const fromThirdService = yield* mappingV3.resolve("persistent-public-key")
        assert.strictEqual(fromThirdService, secondStore)
      }).pipe(Effect.provide(Persistence.layerBackingMemory))
    ))

  it.effect("store mapping persisted returns PersistenceFailure when stored payload is invalid", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const persistedStoreId = "eventlog-server-unencrypted-store-mapping-invalid-payload-test"
        const backing = yield* Persistence.BackingPersistence
        const storage = yield* backing.make(persistedStoreId)

        yield* storage.set("corrupt-public-key", { storeId: 123 }, undefined)

        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingPersisted({
          storeId: persistedStoreId
        })

        const error = yield* Effect.flip(mapping.resolve("corrupt-public-key"))
        assert.instanceOf(error, EventLogServerUnencrypted.EventLogServerStoreError)
        assert.strictEqual(error.reason, "PersistenceFailure")
        assert.strictEqual(error.publicKey, "corrupt-public-key")
      }).pipe(Effect.provide(Persistence.layerBackingMemory))
    ))

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
