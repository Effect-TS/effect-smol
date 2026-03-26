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

const runtimeLayerFromServices = (options: {
  readonly handled: Ref.Ref<ReadonlyArray<string>>
  readonly journal: EventJournal.EventJournal["Service"]
  readonly storage: EventLogServerUnencrypted.Storage["Service"]
  readonly mapping: EventLogServerUnencrypted.StoreMapping["Service"]
  readonly reactivity?: Reactivity.Reactivity["Service"] | undefined
}) =>
  Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
    EventLogServerUnencrypted.make
  ).pipe(
    Layer.provideMerge(Layer.succeed(EventJournal.EventJournal, options.journal)),
    Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.Storage, options.storage)),
    Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.StoreMapping, options.mapping)),
    Layer.provideMerge(layerAuthAllowAll),
    Layer.provideMerge(handlerLayer(options.handled)),
    Layer.provideMerge(
      options.reactivity
        ? Layer.succeed(Reactivity.Reactivity, options.reactivity)
        : Reactivity.layer
    )
  )

const makeJournalFailingFirstRemoteWrite: Effect.Effect<EventJournal.EventJournal["Service"]> = Effect.gen(
  function*() {
    const journal = yield* EventJournal.makeMemory
    let failNextWriteFromRemote = true

    return EventJournal.EventJournal.of({
      ...journal,
      writeFromRemote: (options) =>
        Effect.suspend(() => {
          if (!failNextWriteFromRemote) {
            return journal.writeFromRemote(options)
          }

          failNextWriteFromRemote = false
          return Effect.fail(
            new EventJournal.EventJournalError({
              method: "writeFromRemote",
              cause: new Error("simulated writeFromRemote failure")
            })
          )
        })
    })
  }
)

const makeUserCreatedEntry = (
  id: string,
  options?: {
    readonly createdAtMillis?: number | undefined
  }
): Effect.Effect<EventJournal.Entry> =>
  Effect.gen(function*() {
    const payload = yield* Schema.encodeUnknownEffect(UserGroup.events.UserCreated.payloadMsgPack)({ id }).pipe(
      Effect.orDie
    )
    return new EventJournal.Entry({
      id: EventJournal.makeEntryIdUnsafe(
        options?.createdAtMillis === undefined ? undefined : { msecs: options.createdAtMillis }
      ),
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

  it.effect("server-authored write broadcasts once to all subscribers mapped to a shared store", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const storeId = "store-server-fanout" as EventLogServerUnencrypted.StoreId

          yield* mapping.assign({ publicKey: "fanout-public-key-a", storeId })
          yield* mapping.assign({ publicKey: "fanout-public-key-b", storeId })

          yield* runtime.write({
            schema,
            storeId,
            event: "UserCreated",
            payload: { id: "user-server-fanout" }
          })

          const changesA = yield* runtime.requestChanges("fanout-public-key-a", 0)
          const changesB = yield* runtime.requestChanges("fanout-public-key-b", 0)

          const changeA = yield* Queue.take(changesA)
          const changeB = yield* Queue.take(changesB)

          assert.strictEqual(changeA.remoteSequence, 1)
          assert.strictEqual(changeB.remoteSequence, 1)
          assert.strictEqual(changeA.entry.primaryKey, "user-server-fanout")
          assert.strictEqual(changeB.entry.primaryKey, "user-server-fanout")

          const seen = yield* Ref.get(handled)
          assert.deepStrictEqual(seen, ["user-server-fanout"])
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("server-authored write retries are idempotent when entryId is provided", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const storeId = "store-server-idempotent" as EventLogServerUnencrypted.StoreId
          const entryId = EventJournal.makeEntryIdUnsafe()

          yield* mapping.assign({ publicKey: "idempotent-public-key", storeId })

          yield* runtime.write({
            schema,
            storeId,
            event: "UserCreated",
            payload: { id: "user-server-idempotent" },
            entryId
          })
          yield* runtime.write({
            schema,
            storeId,
            event: "UserCreated",
            payload: { id: "user-server-idempotent" },
            entryId
          })

          const changes = yield* runtime.requestChanges("idempotent-public-key", 0)
          const first = yield* Queue.take(changes)
          assert.strictEqual(first.remoteSequence, 1)
          assert.strictEqual(first.entry.primaryKey, "user-server-idempotent")

          for (let i = 0; i < 10; i++) {
            yield* Effect.yieldNow
          }
          const second = yield* Queue.poll(changes)
          assert.strictEqual(second._tag, "None")

          const seen = yield* Ref.get(handled)
          assert.deepStrictEqual(seen, ["user-server-idempotent"])
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("server-authored duplicate entry ids keep first committed payload semantics", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const storeId = "store-server-duplicate-semantics" as EventLogServerUnencrypted.StoreId
          const duplicateEntryId = EventJournal.makeEntryIdUnsafe()

          yield* mapping.assign({ publicKey: "duplicate-semantics-public-key", storeId })

          yield* runtime.write({
            schema,
            storeId,
            event: "UserCreated",
            payload: { id: "first-accepted" },
            entryId: duplicateEntryId
          })
          yield* runtime.write({
            schema,
            storeId,
            event: "UserCreated",
            payload: { id: "second-duplicate" },
            entryId: duplicateEntryId
          })

          const changes = yield* runtime.requestChanges("duplicate-semantics-public-key", 0)
          const first = yield* Queue.take(changes)
          const decodedPayload = yield* Schema.decodeUnknownEffect(UserGroup.events.UserCreated.payloadMsgPack)(
            first.entry.payload
          ).pipe(Effect.orDie)
          assert.deepStrictEqual(decodedPayload, { id: "first-accepted" })

          for (let i = 0; i < 10; i++) {
            yield* Effect.yieldNow
          }
          const second = yield* Queue.poll(changes)
          assert.strictEqual(second._tag, "None")

          const seen = yield* Ref.get(handled)
          assert.deepStrictEqual(seen, ["first-accepted"])
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("server-authored write fails with NotFound for an unknown store", () =>
    Effect.gen(function*() {
      const handled = yield* Ref.make<ReadonlyArray<string>>([])

      const error = yield* Effect.flip(
        Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          yield* runtime.write({
            schema,
            storeId: "unprovisioned-store" as EventLogServerUnencrypted.StoreId,
            event: "UserCreated",
            payload: { id: "unknown-store-write" }
          })
        }).pipe(Effect.provide(runtimeLayer(handled)))
      )

      assert.instanceOf(error, EventLogServerUnencrypted.EventLogServerStoreError)
      assert.strictEqual(error.reason, "NotFound")
      assert.strictEqual(error.storeId, "unprovisioned-store")
    }))

  it.effect("requestChanges compacts only backlog entries older than olderThan while keeping newer entries raw", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const storeId = "store-compaction-cutoff" as EventLogServerUnencrypted.StoreId
          const now = Date.now()

          yield* mapping.assign({
            publicKey: "public-key-compaction-cutoff",
            storeId
          })

          yield* runtime.registerCompaction({
            events: ["UserCreated"],
            olderThan: "5 seconds",
            effect: Effect.fnUntraced(function*({ entries, write }) {
              const payload = yield* Schema.encodeUnknownEffect(UserGroup.events.UserCreated.payloadMsgPack)({
                id: `${entries[0]!.primaryKey}-compacted`
              }).pipe(Effect.orDie)

              yield* write(
                new EventJournal.Entry({
                  id: EventJournal.makeEntryIdUnsafe({ msecs: entries[0]!.createdAtMillis }),
                  event: "UserCreated",
                  primaryKey: `${entries[0]!.primaryKey}-compacted`,
                  payload
                }, { disableChecks: true })
              )
            })
          })

          yield* runtime.ingest({
            publicKey: "public-key-compaction-cutoff",
            entries: [
              yield* makeUserCreatedEntry("old-user", { createdAtMillis: now - 20_000 }),
              yield* makeUserCreatedEntry("old-user", { createdAtMillis: now - 15_000 }),
              yield* makeUserCreatedEntry("recent-user", { createdAtMillis: now - 1_000 })
            ]
          })

          const fromStart = yield* runtime.requestChanges("public-key-compaction-cutoff", 0)
          const first = yield* Queue.take(fromStart)
          const second = yield* Queue.take(fromStart)

          assert.deepStrictEqual(
            [first.remoteSequence, second.remoteSequence],
            [2, 3]
          )
          assert.deepStrictEqual(
            [first.entry.primaryKey, second.entry.primaryKey],
            ["old-user-compacted", "recent-user"]
          )
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("requestChanges emits strictly monotonic representative sequences that remain cursor-safe", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const storeId = "store-compaction-cursor" as EventLogServerUnencrypted.StoreId
          const now = Date.now()

          yield* mapping.assign({
            publicKey: "public-key-compaction-cursor",
            storeId
          })

          yield* runtime.registerCompaction({
            events: ["UserCreated"],
            olderThan: "5 seconds",
            effect: Effect.fnUntraced(function*({ entries, write }) {
              const payloadFirst = yield* Schema.encodeUnknownEffect(UserGroup.events.UserCreated.payloadMsgPack)({
                id: `${entries[0]!.primaryKey}-snapshot-1`
              }).pipe(Effect.orDie)
              const payloadSecond = yield* Schema.encodeUnknownEffect(UserGroup.events.UserCreated.payloadMsgPack)({
                id: `${entries[0]!.primaryKey}-snapshot-2`
              }).pipe(Effect.orDie)

              yield* write(
                new EventJournal.Entry({
                  id: EventJournal.makeEntryIdUnsafe({ msecs: entries[0]!.createdAtMillis }),
                  event: "UserCreated",
                  primaryKey: `${entries[0]!.primaryKey}-snapshot-1`,
                  payload: payloadFirst
                }, { disableChecks: true })
              )
              yield* write(
                new EventJournal.Entry({
                  id: EventJournal.makeEntryIdUnsafe({ msecs: entries[entries.length - 1]!.createdAtMillis }),
                  event: "UserCreated",
                  primaryKey: `${entries[0]!.primaryKey}-snapshot-2`,
                  payload: payloadSecond
                }, { disableChecks: true })
              )
            })
          })

          yield* runtime.ingest({
            publicKey: "public-key-compaction-cursor",
            entries: [
              yield* makeUserCreatedEntry("history-user", { createdAtMillis: now - 20_000 }),
              yield* makeUserCreatedEntry("history-user", { createdAtMillis: now - 19_000 }),
              yield* makeUserCreatedEntry("history-user", { createdAtMillis: now - 18_000 }),
              yield* makeUserCreatedEntry("recent-user", { createdAtMillis: now - 1_000 })
            ]
          })

          const fromStart = yield* runtime.requestChanges("public-key-compaction-cursor", 0)
          const startFirst = yield* Queue.take(fromStart)
          const startSecond = yield* Queue.take(fromStart)
          const startThird = yield* Queue.take(fromStart)

          assert.deepStrictEqual(
            [startFirst.remoteSequence, startSecond.remoteSequence, startThird.remoteSequence],
            [1, 3, 4]
          )

          const fromOne = yield* runtime.requestChanges("public-key-compaction-cursor", 1)
          const fromOneFirst = yield* Queue.take(fromOne)
          const fromOneSecond = yield* Queue.take(fromOne)
          assert.deepStrictEqual(
            [fromOneFirst.remoteSequence, fromOneSecond.remoteSequence],
            [3, 4]
          )

          const fromThree = yield* runtime.requestChanges("public-key-compaction-cursor", 3)
          const fromThreeOnly = yield* Queue.take(fromThree)
          assert.strictEqual(fromThreeOnly.remoteSequence, 4)
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("public keys sharing one StoreId observe compatible compacted cursors", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping
          const storeId = "store-compaction-shared-cursor" as EventLogServerUnencrypted.StoreId
          const now = Date.now()

          yield* mapping.assign({ publicKey: "public-key-compaction-a", storeId })
          yield* mapping.assign({ publicKey: "public-key-compaction-b", storeId })

          yield* runtime.registerCompaction({
            events: ["UserCreated"],
            olderThan: "5 seconds",
            effect: Effect.fnUntraced(function*({ entries, write }) {
              const payload = yield* Schema.encodeUnknownEffect(UserGroup.events.UserCreated.payloadMsgPack)({
                id: `${entries[0]!.primaryKey}-shared-compacted`
              }).pipe(Effect.orDie)

              yield* write(
                new EventJournal.Entry({
                  id: EventJournal.makeEntryIdUnsafe({ msecs: entries[0]!.createdAtMillis }),
                  event: "UserCreated",
                  primaryKey: `${entries[0]!.primaryKey}-shared-compacted`,
                  payload
                }, { disableChecks: true })
              )
            })
          })

          yield* runtime.ingest({
            publicKey: "public-key-compaction-a",
            entries: [yield* makeUserCreatedEntry("shared-history", { createdAtMillis: now - 20_000 })]
          })
          yield* runtime.ingest({
            publicKey: "public-key-compaction-b",
            entries: [yield* makeUserCreatedEntry("shared-history", { createdAtMillis: now - 19_000 })]
          })
          yield* runtime.ingest({
            publicKey: "public-key-compaction-a",
            entries: [yield* makeUserCreatedEntry("shared-recent", { createdAtMillis: now - 1_000 })]
          })

          const fromAStart = yield* runtime.requestChanges("public-key-compaction-a", 0)
          const fromAFirst = yield* Queue.take(fromAStart)
          const fromASecond = yield* Queue.take(fromAStart)
          assert.deepStrictEqual([fromAFirst.remoteSequence, fromASecond.remoteSequence], [2, 3])

          const fromBAtCursor = yield* runtime.requestChanges("public-key-compaction-b", fromAFirst.remoteSequence)
          const fromBCursorOnly = yield* Queue.take(fromBAtCursor)

          const fromAAtCursor = yield* runtime.requestChanges("public-key-compaction-a", fromAFirst.remoteSequence)
          const fromACursorOnly = yield* Queue.take(fromAAtCursor)

          assert.strictEqual(fromBCursorOnly.remoteSequence, 3)
          assert.strictEqual(fromACursorOnly.remoteSequence, 3)
          assert.strictEqual(fromBCursorOnly.entry.primaryKey, "shared-recent")
          assert.strictEqual(fromACursorOnly.entry.primaryKey, "shared-recent")
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("reconciliation replays persisted backlog exactly once without duplicate handler or Reactivity execution", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])
        const invalidations = yield* Ref.make(0)
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingMemory
        const journal = yield* makeJournalFailingFirstRemoteWrite
        const storeId = "store-reconciliation" as EventLogServerUnencrypted.StoreId

        yield* mapping.assign({
          publicKey: "public-key-reconciliation",
          storeId
        })

        const firstRuntimeLayer = runtimeLayerFromServices({
          handled,
          journal,
          storage,
          mapping
        })

        const replayFailure = yield* Effect.flip(
          Effect.gen(function*() {
            const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
            const entry = yield* makeUserCreatedEntry("user-backlog")
            yield* runtime.ingest({
              publicKey: "public-key-reconciliation",
              entries: [entry]
            })
          }).pipe(Effect.provide(firstRuntimeLayer))
        )
        assert.instanceOf(replayFailure, EventJournal.EventJournalError)

        const persistedBacklog = yield* storage.entries(storeId, 0)
        assert.deepStrictEqual(persistedBacklog.map((entry) => entry.remoteSequence), [1])
        assert.deepStrictEqual(yield* Ref.get(handled), [])

        const secondRuntimeLayer = runtimeLayerFromServices({
          handled,
          journal,
          storage,
          mapping
        })

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const reactivity = yield* Reactivity.Reactivity

          yield* runtime.registerReactivity({
            UserCreated: ["users"]
          })

          const query = yield* reactivity.query(
            { users: ["user-backlog"] },
            Ref.updateAndGet(invalidations, (count) => count + 1)
          )

          const initial = yield* Queue.take(query)
          assert.strictEqual(initial, 1)

          yield* runtime.requestChanges("public-key-reconciliation", 0)
          const afterRecovery = yield* Queue.take(query)
          assert.strictEqual(afterRecovery, 2)

          assert.deepStrictEqual(yield* Ref.get(handled), ["user-backlog"])

          for (let i = 0; i < 10; i++) {
            yield* Effect.yieldNow
          }

          while (true) {
            const next = yield* Queue.poll(query)
            if (next._tag === "None") {
              break
            }
          }

          const invalidationsBeforeSecondRead = yield* Ref.get(invalidations)

          yield* runtime.requestChanges("public-key-reconciliation", 0)

          for (let i = 0; i < 10; i++) {
            yield* Effect.yieldNow
          }

          const duplicateInvalidation = yield* Queue.poll(query)
          assert.strictEqual(duplicateInvalidation._tag, "None")

          assert.deepStrictEqual(yield* Ref.get(handled), ["user-backlog"])
          assert.strictEqual(yield* Ref.get(invalidations), invalidationsBeforeSecondRead)
        }).pipe(Effect.provide(secondRuntimeLayer))

        const thirdRuntimeLayer = runtimeLayerFromServices({
          handled,
          journal,
          storage,
          mapping
        })

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const reactivity = yield* Reactivity.Reactivity

          yield* runtime.registerReactivity({
            UserCreated: ["users"]
          })

          const invalidationsBeforeQuery = yield* Ref.get(invalidations)
          const query = yield* reactivity.query(
            { users: ["user-backlog"] },
            Ref.updateAndGet(invalidations, (count) => count + 1)
          )

          const initial = yield* Queue.take(query)
          assert.strictEqual(initial, invalidationsBeforeQuery + 1)

          const beforeRestartRead = yield* Ref.get(invalidations)
          yield* runtime.requestChanges("public-key-reconciliation", 0)

          for (let i = 0; i < 10; i++) {
            yield* Effect.yieldNow
          }

          const restartDuplicateInvalidation = yield* Queue.poll(query)
          assert.strictEqual(restartDuplicateInvalidation._tag, "None")
          assert.deepStrictEqual(yield* Ref.get(handled), ["user-backlog"])
          assert.strictEqual(yield* Ref.get(invalidations), beforeRestartRead)
        }).pipe(Effect.provide(thirdRuntimeLayer))
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

  it.effect("store mapping persisted supports metadata-like public keys and legacy mapping records", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const persistedStoreId = "eventlog-server-unencrypted-store-mapping-compatibility-test"
        const backing = yield* Persistence.BackingPersistence
        const storage = yield* backing.make(persistedStoreId)
        const legacyStore = "legacy-store" as EventLogServerUnencrypted.StoreId

        yield* storage.set("legacy-public-key", { storeId: legacyStore }, undefined)

        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingPersisted({
          storeId: persistedStoreId
        })

        const resolvedLegacy = yield* mapping.resolve("legacy-public-key")
        assert.strictEqual(resolvedLegacy, legacyStore)
        assert.strictEqual(yield* mapping.hasStore(legacyStore), true)

        const metadataLikePublicKey = "@store/store-metadata-like"
        const metadataStore = "store-metadata-like" as EventLogServerUnencrypted.StoreId
        yield* mapping.assign({
          publicKey: metadataLikePublicKey,
          storeId: metadataStore
        })

        const resolvedMetadataLike = yield* mapping.resolve(metadataLikePublicKey)
        assert.strictEqual(resolvedMetadataLike, metadataStore)
        assert.strictEqual(yield* mapping.hasStore(metadataStore), true)
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
