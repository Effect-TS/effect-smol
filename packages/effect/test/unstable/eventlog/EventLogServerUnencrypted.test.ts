import { assert, describe, it } from "@effect/vitest"
import { Deferred, Effect, Fiber, Layer, Queue, Ref, Schema } from "effect"
import * as EventGroup from "effect/unstable/eventlog/EventGroup"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogRemote from "effect/unstable/eventlog/EventLogRemote"
import * as EventLogServerUnencrypted from "effect/unstable/eventlog/EventLogServerUnencrypted"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Socket from "effect/unstable/socket/Socket"

const UserPayload = Schema.Struct({
  id: Schema.String
})

const UserGroup = EventGroup.empty.add({
  tag: "UserCreated",
  primaryKey: (payload) => payload.id,
  payload: UserPayload
})

const schema = EventLog.schema(UserGroup)

const authAllowAll = EventLogServerUnencrypted.EventLogServerAuth.of({
  authorizeWrite: () => Effect.void,
  authorizeRead: () => Effect.void
})

const layerAuthAllowAll = Layer.succeed(
  EventLogServerUnencrypted.EventLogServerAuth,
  authAllowAll
)

const handlerLayer = (handled: Ref.Ref<ReadonlyArray<string>>) =>
  EventLog.group(
    UserGroup,
    (handlers) =>
      handlers.handle("UserCreated", ({ payload }) => Ref.update(handled, (values) => [...values, payload.id]))
  )

type StoreMappingMemoryOptions = Parameters<typeof EventLogServerUnencrypted.layerStoreMappingMemory>[0]

const runtimeLayerWithStoreMapping = (options: {
  readonly handled: Ref.Ref<ReadonlyArray<string>>
  readonly storeMappingLayer: Layer.Layer<EventLogServerUnencrypted.StoreMapping>
  readonly authLayer?: Layer.Layer<EventLogServerUnencrypted.EventLogServerAuth> | undefined
}) =>
  EventLogServerUnencrypted.layer(schema).pipe(
    Layer.provideMerge(EventLogServerUnencrypted.layerStorageMemory),
    Layer.provideMerge(options.storeMappingLayer),
    Layer.provideMerge(options.authLayer ?? layerAuthAllowAll),
    Layer.provideMerge(handlerLayer(options.handled))
  )

const runtimeLayerWithAuth = (options: {
  readonly handled: Ref.Ref<ReadonlyArray<string>>
  readonly authLayer: Layer.Layer<EventLogServerUnencrypted.EventLogServerAuth>
  readonly storeMappingOptions?: StoreMappingMemoryOptions | undefined
}) =>
  runtimeLayerWithStoreMapping({
    handled: options.handled,
    authLayer: options.authLayer,
    storeMappingLayer: EventLogServerUnencrypted.layerStoreMappingMemory(options.storeMappingOptions)
  })

const runtimeLayer = (
  handled: Ref.Ref<ReadonlyArray<string>>,
  storeMappingOptions?: StoreMappingMemoryOptions | undefined
) =>
  runtimeLayerWithAuth({
    handled,
    authLayer: layerAuthAllowAll,
    storeMappingOptions
  })

const runtimeLayerFromServices = (options: {
  readonly handled: Ref.Ref<ReadonlyArray<string>>
  readonly storage: EventLogServerUnencrypted.Storage["Service"]
  readonly mapping: EventLogServerUnencrypted.StoreMapping["Service"]
  readonly reactivity?: Reactivity.Reactivity["Service"] | undefined
}) =>
  Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
    EventLogServerUnencrypted.make
  ).pipe(
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

const makeSocketHarness = Effect.gen(function*() {
  const inbound = yield* Queue.unbounded<Uint8Array>()
  const outbound = yield* Queue.unbounded<Uint8Array>()
  const encoder = new TextEncoder()

  const runLoop = <A, E, R>(
    handler: (_: Uint8Array) => Effect.Effect<A, E, R> | void,
    options?: {
      readonly onOpen?: Effect.Effect<void> | undefined
    }
  ): Effect.Effect<void, E, R> =>
    Effect.gen(function*() {
      if (options?.onOpen) {
        yield* options.onOpen
      }

      while (true) {
        const data = yield* Queue.take(inbound)
        const effect = handler(data)
        if (Effect.isEffect(effect)) {
          yield* effect
        }
      }
    })

  const socket: Socket.Socket = {
    [Socket.TypeId]: Socket.TypeId,
    run: (handler, options) => runLoop(handler, options),
    runRaw: (handler, options) => runLoop((data) => handler(data), options),
    writer: Effect.succeed((chunk) => {
      if (chunk instanceof Uint8Array) {
        return Queue.offer(outbound, chunk).pipe(Effect.asVoid)
      }
      if (typeof chunk === "string") {
        return Queue.offer(outbound, encoder.encode(chunk)).pipe(Effect.asVoid)
      }
      return Effect.void
    })
  }

  return {
    socket,
    sendRequest: (request: typeof EventLogRemote.ProtocolRequestUnencrypted.Type) =>
      EventLogRemote.encodeRequestUnencrypted(request).pipe(
        Effect.flatMap((data) => Queue.offer(inbound, data)),
        Effect.asVoid
      ),
    takeResponse: Queue.take(outbound).pipe(Effect.flatMap(EventLogRemote.decodeResponseUnencrypted))
  }
})

describe("EventLogServerUnencrypted", () => {
  it.effect("accepted ingest runs handlers", () =>
    Effect.gen(function*() {
      const handled = yield* Ref.make<ReadonlyArray<string>>([])

      yield* Effect.gen(function*() {
        const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
        const storeId = "store-runtime-handler" as EventLogServerUnencrypted.StoreId

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
      }).pipe(Effect.provide(runtimeLayer(handled, {
        mappings: [["public-key-handler", "store-runtime-handler" as EventLogServerUnencrypted.StoreId]]
      })))
    }))

  it.effect("accepted ingest triggers Reactivity invalidation", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])
        const invalidations = yield* Ref.make(0)

        const runtimeLayerWithReactivity = Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
          EventLogServerUnencrypted.make
        ).pipe(
          Layer.provideMerge(EventLogServerUnencrypted.layerStorageMemory),
          Layer.provideMerge(EventLogServerUnencrypted.layerStoreMappingMemory({
            mappings: [["public-key-reactivity", "store-reactivity" as EventLogServerUnencrypted.StoreId]]
          })),
          Layer.provideMerge(layerAuthAllowAll),
          Layer.provideMerge(handlerLayer(handled)),
          Layer.provideMerge(Reactivity.layer)
        )

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const reactivity = yield* Reactivity.Reactivity
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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [
            ["public-key-a", "store-shared-feed" as EventLogServerUnencrypted.StoreId],
            ["public-key-b", "store-shared-feed" as EventLogServerUnencrypted.StoreId]
          ]
        })))
      })
    ))

  it.effect("different stores replay independently even with overlapping sequence numbers", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [
            ["public-key-store-a", "store-a" as EventLogServerUnencrypted.StoreId],
            ["public-key-store-b", "store-b" as EventLogServerUnencrypted.StoreId]
          ]
        })))
      })
    ))

  it.effect("server-authored write broadcasts once to all subscribers mapped to a shared store", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const storeId = "store-server-fanout" as EventLogServerUnencrypted.StoreId

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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [
            ["fanout-public-key-a", "store-server-fanout" as EventLogServerUnencrypted.StoreId],
            ["fanout-public-key-b", "store-server-fanout" as EventLogServerUnencrypted.StoreId]
          ]
        })))
      })
    ))

  it.effect("server-authored write retries are idempotent when entryId is provided", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const storeId = "store-server-idempotent" as EventLogServerUnencrypted.StoreId
          const entryId = EventJournal.makeEntryIdUnsafe()

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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [["idempotent-public-key", "store-server-idempotent" as EventLogServerUnencrypted.StoreId]]
        })))
      })
    ))

  it.effect("server-authored duplicate entry ids keep first committed payload semantics", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const storeId = "store-server-duplicate-semantics" as EventLogServerUnencrypted.StoreId
          const duplicateEntryId = EventJournal.makeEntryIdUnsafe()

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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [[
            "duplicate-semantics-public-key",
            "store-server-duplicate-semantics" as EventLogServerUnencrypted.StoreId
          ]]
        })))
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

  it.effect("server-authored write does not infer store existence from persisted history", () =>
    Effect.gen(function*() {
      const handled = yield* Ref.make<ReadonlyArray<string>>([])
      const storeId = "store-history-only" as EventLogServerUnencrypted.StoreId
      const mapping = EventLogServerUnencrypted.StoreMapping.of({
        resolve: Effect.fnUntraced(function*() {
          return storeId
        }),
        hasStore: Effect.fnUntraced(function*() {
          return false
        })
      })
      const storage = yield* EventLogServerUnencrypted.makeStorageMemory

      const writeError = yield* Effect.flip(
        Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          yield* runtime.ingest({
            publicKey: "public-key-history-only",
            entries: [yield* makeUserCreatedEntry("seed-history-only")]
          })

          yield* runtime.write({
            schema,
            storeId,
            event: "UserCreated",
            payload: { id: "server-write-history-only" }
          })
        }).pipe(Effect.provide(runtimeLayerFromServices({ handled, mapping, storage })))
      )

      assert.instanceOf(writeError, EventLogServerUnencrypted.EventLogServerStoreError)
      assert.strictEqual(writeError.reason, "NotFound")
      assert.strictEqual(writeError.storeId, storeId)
      assert.deepStrictEqual(yield* Ref.get(handled), ["seed-history-only"])
    }))

  it.effect("requestChanges compacts only backlog entries older than olderThan while keeping newer entries raw", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const now = Date.now()

          yield* EventLogServerUnencrypted.groupCompaction(
            UserGroup,
            { olderThan: "5 seconds" },
            ({ entries, write }) =>
              write("UserCreated", {
                id: `${entries[0]!.primaryKey}-compacted`
              })
          ).pipe(
            Layer.build,
            Effect.asVoid
          )

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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [["public-key-compaction-cutoff", "store-compaction-cutoff" as EventLogServerUnencrypted.StoreId]]
        })))
      })
    ))

  it.effect("requestChanges emits strictly monotonic representative sequences that remain cursor-safe", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const now = Date.now()

          yield* EventLogServerUnencrypted.groupCompaction(
            UserGroup,
            { olderThan: "5 seconds" },
            ({ entries, write }) =>
              Effect.gen(function*() {
                yield* write("UserCreated", {
                  id: `${entries[0]!.primaryKey}-snapshot-1`
                })
                yield* write("UserCreated", {
                  id: `${entries[0]!.primaryKey}-snapshot-2`
                })
              })
          ).pipe(
            Layer.build,
            Effect.asVoid
          )

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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [["public-key-compaction-cursor", "store-compaction-cursor" as EventLogServerUnencrypted.StoreId]]
        })))
      })
    ))

  it.effect("public keys sharing one StoreId observe compatible compacted cursors", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const now = Date.now()

          yield* EventLogServerUnencrypted.groupCompaction(
            UserGroup,
            { olderThan: "5 seconds" },
            ({ entries, write }) =>
              write("UserCreated", {
                id: `${entries[0]!.primaryKey}-shared-compacted`
              })
          ).pipe(
            Layer.build,
            Effect.asVoid
          )

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
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [
            ["public-key-compaction-a", "store-compaction-shared-cursor" as EventLogServerUnencrypted.StoreId],
            ["public-key-compaction-b", "store-compaction-shared-cursor" as EventLogServerUnencrypted.StoreId]
          ]
        })))
      })
    ))

  it.effect("failed handlers roll back the full batch without publishing changes or Reactivity invalidation", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingMemory({
          mappings: [["public-key-rollback", "store-rollback" as EventLogServerUnencrypted.StoreId]]
        })
        const reactivity = yield* Reactivity.make
        const invalidations = yield* Ref.make(0)
        const storeId = "store-rollback" as EventLogServerUnencrypted.StoreId

        const runtimeLayerWithFailingHandler = Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
          EventLogServerUnencrypted.make
        ).pipe(
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.Storage, storage)),
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.StoreMapping, mapping)),
          Layer.provideMerge(layerAuthAllowAll),
          Layer.provideMerge(
            EventLog.group(
              UserGroup,
              (handlers) =>
                handlers.handle("UserCreated", ({ payload }) =>
                  payload.id === "rollback-fail"
                    ? Effect.die(new Error("simulated handler failure"))
                    : Effect.void)
            )
          ),
          Layer.provideMerge(Layer.succeed(Reactivity.Reactivity, reactivity))
        )

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const reactivity = yield* Reactivity.Reactivity

          yield* runtime.registerReactivity({
            UserCreated: ["users"]
          })

          const query = yield* reactivity.query(
            { users: ["rollback-user"] },
            Ref.updateAndGet(invalidations, (count) => count + 1)
          )
          assert.strictEqual(yield* Queue.take(query), 1)

          const rollbackEntry = yield* makeUserCreatedEntry("rollback-user")
          const failingEntry = yield* makeUserCreatedEntry("rollback-fail")

          const error = yield* Effect.flip(
            runtime.ingest({
              publicKey: "public-key-rollback",
              entries: [rollbackEntry, failingEntry]
            })
          )

          assert.instanceOf(error, EventJournal.EventJournalError)
          assert.deepStrictEqual(yield* storage.entries(storeId, 0), [])

          const changes = yield* runtime.requestChanges("public-key-rollback", 0)
          const unpublished = yield* Queue.poll(changes)
          assert.strictEqual(unpublished._tag, "None")

          for (let i = 0; i < 10; i++) {
            yield* Effect.yieldNow
          }
          const duplicateInvalidation = yield* Queue.poll(query)
          assert.strictEqual(duplicateInvalidation._tag, "None")
          assert.strictEqual(yield* Ref.get(invalidations), 1)

          const retry = yield* runtime.ingest({
            publicKey: "public-key-rollback",
            entries: [rollbackEntry]
          })
          assert.deepStrictEqual(retry.sequenceNumbers, [1])
          assert.deepStrictEqual(retry.committed.map((entry) => entry.remoteSequence), [1])
        }).pipe(Effect.provide(runtimeLayerWithFailingHandler))
      })
    ))

  it.effect("requestChanges cannot observe an in-flight write before the transaction commits", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingMemory({
          mappings: [["public-key-visibility", "store-visibility" as EventLogServerUnencrypted.StoreId]]
        })
        const enteredHandler = yield* Deferred.make<void>()
        const allowCommit = yield* Deferred.make<void>()
        const storeId = "store-visibility" as EventLogServerUnencrypted.StoreId

        const runtimeLayerWithBlockingHandler = Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
          EventLogServerUnencrypted.make
        ).pipe(
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.Storage, storage)),
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.StoreMapping, mapping)),
          Layer.provideMerge(layerAuthAllowAll),
          Layer.provideMerge(
            EventLog.group(
              UserGroup,
              (handlers) =>
                handlers.handle("UserCreated", ({ payload }) =>
                  payload.id === "visibility-user"
                    ? Deferred.succeed(enteredHandler, undefined).pipe(
                      Effect.andThen(Deferred.await(allowCommit))
                    )
                    : Effect.void)
            )
          ),
          Layer.provideMerge(Reactivity.layer)
        )

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          const ingestFiber = yield* runtime.ingest({
            publicKey: "public-key-visibility",
            entries: [yield* makeUserCreatedEntry("visibility-user")]
          }).pipe(Effect.forkScoped)

          yield* Deferred.await(enteredHandler)

          const changesBeforeCommit = yield* runtime.requestChanges("public-key-visibility", 0)
          const beforeCommitFromChanges = yield* Queue.poll(changesBeforeCommit)
          assert.strictEqual(beforeCommitFromChanges._tag, "None")

          assert.deepStrictEqual(yield* storage.entries(storeId, 0), [])

          yield* Deferred.succeed(allowCommit, undefined)
          yield* Fiber.join(ingestFiber)

          assert.deepStrictEqual((yield* storage.entries(storeId, 0)).map((entry) => entry.remoteSequence), [1])

          const changesAfterCommit = yield* runtime.requestChanges("public-key-visibility", 0)
          const committedEntry = yield* Queue.take(changesAfterCommit)
          assert.strictEqual(committedEntry.remoteSequence, 1)
          assert.strictEqual(committedEntry.entry.primaryKey, "visibility-user")
        }).pipe(Effect.provide(runtimeLayerWithBlockingHandler))
      })
    ))

  it.effect("requestChanges does not lose a commit during the backlog-to-live transition", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingMemory({
          mappings: [
            ["cutover-replica-a", "store-cutover" as EventLogServerUnencrypted.StoreId],
            ["cutover-replica-b", "store-cutover" as EventLogServerUnencrypted.StoreId]
          ]
        })
        const handledA = yield* Ref.make<ReadonlyArray<string>>([])
        const handledB = yield* Ref.make<ReadonlyArray<string>>([])
        const compactionStarted = yield* Deferred.make<void>()
        const allowCompaction = yield* Deferred.make<void>()

        const replicaALayer = runtimeLayerFromServices({
          handled: handledA,
          storage,
          mapping
        })
        const replicaBLayer = runtimeLayerFromServices({
          handled: handledB,
          storage,
          mapping
        })

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          yield* runtime.ingest({
            publicKey: "cutover-replica-a",
            entries: [yield* makeUserCreatedEntry("cutover-history", { createdAtMillis: Date.now() - 20_000 })]
          })
        }).pipe(Effect.provide(replicaALayer))

        const changesFiber = yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          yield* runtime.registerCompaction({
            events: ["UserCreated"],
            olderThan: "5 seconds",
            effect: Effect.fnUntraced(function*({ entries, write }) {
              assert.deepStrictEqual(entries.map((entry) => entry.primaryKey), ["cutover-history"])
              yield* Deferred.succeed(compactionStarted, undefined)
              yield* Deferred.await(allowCompaction)
              yield* write(
                yield* makeUserCreatedEntry("cutover-history-compacted", {
                  createdAtMillis: entries[entries.length - 1]!.createdAtMillis
                })
              )
            })
          })

          return yield* runtime.requestChanges("cutover-replica-b", 0)
        }).pipe(
          Effect.provide(replicaBLayer),
          Effect.forkScoped
        )

        yield* Deferred.await(compactionStarted)

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          yield* runtime.ingest({
            publicKey: "cutover-replica-a",
            entries: [yield* makeUserCreatedEntry("cutover-live")]
          })
        }).pipe(Effect.provide(replicaALayer))

        yield* Deferred.succeed(allowCompaction, undefined)

        const changes = yield* Fiber.join(changesFiber)
        const compactedBacklog = yield* Queue.take(changes)
        const liveCommit = yield* Queue.take(changes)

        assert.strictEqual(compactedBacklog.remoteSequence, 1)
        assert.strictEqual(compactedBacklog.entry.primaryKey, "cutover-history-compacted")
        assert.strictEqual(liveCommit.remoteSequence, 2)
        assert.strictEqual(liveCommit.entry.primaryKey, "cutover-live")
      })
    ))

  it.effect("a requestChanges subscriber on one replica observes commits produced by another replica", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingMemory({
          mappings: [
            ["shared-replica-a", "shared-request-changes-store" as EventLogServerUnencrypted.StoreId],
            ["shared-replica-b", "shared-request-changes-store" as EventLogServerUnencrypted.StoreId]
          ]
        })
        const handledA = yield* Ref.make<ReadonlyArray<string>>([])
        const handledB = yield* Ref.make<ReadonlyArray<string>>([])

        const replicaALayer = runtimeLayerFromServices({
          handled: handledA,
          storage,
          mapping
        })
        const replicaBLayer = runtimeLayerFromServices({
          handled: handledB,
          storage,
          mapping
        })

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          yield* runtime.ingest({
            publicKey: "shared-replica-a",
            entries: [yield* makeUserCreatedEntry("shared-request-changes-user")]
          })
        }).pipe(Effect.provide(replicaALayer))

        const observed = yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const changes = yield* runtime.requestChanges("shared-replica-b", 0)
          return yield* Queue.take(changes)
        }).pipe(Effect.provide(replicaBLayer))

        assert.strictEqual(observed.remoteSequence, 1)
        assert.strictEqual(observed.entry.primaryKey, "shared-request-changes-user")
      })
    ))

  it.effect("concurrent replicas writing to the same store share one ordered sequence space", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingMemory({
          mappings: [
            ["same-store-replica-a", "same-store" as EventLogServerUnencrypted.StoreId],
            ["same-store-replica-b", "same-store" as EventLogServerUnencrypted.StoreId]
          ]
        })

        const replicaALayer = runtimeLayerFromServices({
          handled,
          storage,
          mapping
        })
        const replicaBLayer = runtimeLayerFromServices({
          handled,
          storage,
          mapping
        })

        const replicaAFiber = yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          return yield* runtime.ingest({
            publicKey: "same-store-replica-a",
            entries: [yield* makeUserCreatedEntry("same-store-user-a")]
          })
        }).pipe(
          Effect.provide(replicaALayer),
          Effect.forkScoped
        )

        const replicaBFiber = yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          return yield* runtime.ingest({
            publicKey: "same-store-replica-b",
            entries: [yield* makeUserCreatedEntry("same-store-user-b")]
          })
        }).pipe(
          Effect.provide(replicaBLayer),
          Effect.forkScoped
        )

        const resultA = yield* Fiber.join(replicaAFiber)
        const resultB = yield* Fiber.join(replicaBFiber)
        assert.deepStrictEqual(
          [resultA.sequenceNumbers[0], resultB.sequenceNumbers[0]].sort((a, b) => a - b),
          [1, 2]
        )

        const committed = yield* storage.entries("same-store" as EventLogServerUnencrypted.StoreId, 0)
        assert.deepStrictEqual(committed.map((entry) => entry.remoteSequence), [1, 2])
        assert.deepStrictEqual(
          committed.map((entry) => entry.entry.primaryKey).sort(),
          ["same-store-user-a", "same-store-user-b"]
        )
        assert.deepStrictEqual((yield* Ref.get(handled)).slice().sort(), ["same-store-user-a", "same-store-user-b"])
      })
    ))

  it.effect("concurrent replica writes stay isolated across different stores", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const mapping = yield* EventLogServerUnencrypted.makeStoreMappingMemory({
          mappings: [
            ["isolation-replica-a", "store-isolation-a" as EventLogServerUnencrypted.StoreId],
            ["isolation-replica-b", "store-isolation-b" as EventLogServerUnencrypted.StoreId]
          ]
        })
        const enteredStoreAHandler = yield* Deferred.make<void>()
        const allowStoreACommit = yield* Deferred.make<void>()

        const blockingHandlerLayer = EventLog.group(
          UserGroup,
          (handlers) =>
            handlers.handle("UserCreated", ({ payload }) =>
              payload.id === "store-a-blocking"
                ? Deferred.succeed(enteredStoreAHandler, undefined).pipe(
                  Effect.andThen(Deferred.await(allowStoreACommit))
                )
                : Effect.void)
        )

        const replicaALayer = Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
          EventLogServerUnencrypted.make
        ).pipe(
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.Storage, storage)),
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.StoreMapping, mapping)),
          Layer.provideMerge(layerAuthAllowAll),
          Layer.provideMerge(blockingHandlerLayer),
          Layer.provideMerge(Reactivity.layer)
        )

        const replicaBLayer = Layer.effect(EventLogServerUnencrypted.EventLogServerUnencrypted)(
          EventLogServerUnencrypted.make
        ).pipe(
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.Storage, storage)),
          Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.StoreMapping, mapping)),
          Layer.provideMerge(layerAuthAllowAll),
          Layer.provideMerge(blockingHandlerLayer),
          Layer.provideMerge(Reactivity.layer)
        )

        const storeAFiber = yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          return yield* runtime.ingest({
            publicKey: "isolation-replica-a",
            entries: [yield* makeUserCreatedEntry("store-a-blocking")]
          })
        }).pipe(
          Effect.provide(replicaALayer),
          Effect.forkScoped
        )

        yield* Deferred.await(enteredStoreAHandler)

        const storeBFiber = yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          return yield* runtime.ingest({
            publicKey: "isolation-replica-b",
            entries: [yield* makeUserCreatedEntry("store-b-fast")]
          })
        }).pipe(
          Effect.provide(replicaBLayer),
          Effect.forkScoped
        )

        const storeBResult = yield* Fiber.join(storeBFiber)
        assert.deepStrictEqual(storeBResult.sequenceNumbers, [1])

        const storeABeforeRelease = yield* Effect.sync(() => storeAFiber.pollUnsafe())
        assert.strictEqual(storeABeforeRelease, undefined)

        yield* Deferred.succeed(allowStoreACommit, undefined)
        const storeAResult = yield* Fiber.join(storeAFiber)
        assert.deepStrictEqual(storeAResult.sequenceNumbers, [1])

        const storeAEntries = yield* storage.entries("store-isolation-a" as EventLogServerUnencrypted.StoreId, 0)
        const storeBEntries = yield* storage.entries("store-isolation-b" as EventLogServerUnencrypted.StoreId, 0)
        assert.deepStrictEqual(storeAEntries.map((entry) => entry.entry.primaryKey), ["store-a-blocking"])
        assert.deepStrictEqual(storeBEntries.map((entry) => entry.entry.primaryKey), ["store-b-fast"])
      })
    ))

  it.effect("makeHandler processes unencrypted writes and requestChanges end-to-end", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const handler = yield* EventLogServerUnencrypted.makeHandler
          const harness = yield* makeSocketHarness
          const publicKey = "public-key-handler-socket-success"

          yield* handler(harness.socket).pipe(Effect.forkScoped)

          const hello = yield* harness.takeResponse
          assert.strictEqual(hello._tag, "Hello")

          const firstEntry = yield* makeUserCreatedEntry("socket-user-1")
          const secondEntry = yield* makeUserCreatedEntry("socket-user-2")

          yield* harness.sendRequest(
            new EventLogRemote.RequestChanges({
              publicKey,
              startSequence: 0
            })
          )
          yield* harness.sendRequest(
            new EventLogRemote.WriteEntriesUnencrypted({
              publicKey,
              id: 42,
              entries: [firstEntry, secondEntry]
            })
          )

          const firstResponse = yield* harness.takeResponse
          const secondResponse = yield* harness.takeResponse

          const ack = firstResponse._tag === "Ack"
            ? firstResponse
            : secondResponse._tag === "Ack"
            ? secondResponse
            : undefined
          const changes = firstResponse._tag === "Changes"
            ? firstResponse
            : secondResponse._tag === "Changes"
            ? secondResponse
            : undefined

          if (ack === undefined) {
            throw new Error("Expected Ack response from websocket write")
          }
          if (changes === undefined) {
            throw new Error("Expected Changes response from websocket subscription")
          }

          assert.strictEqual(ack.id, 42)
          assert.strictEqual(ack.sequenceNumbers.length, 2)
          assert.deepStrictEqual(changes.entries.map((entry) => entry.entry.primaryKey), [
            "socket-user-1",
            "socket-user-2"
          ])
          assert.deepStrictEqual(yield* Ref.get(handled), ["socket-user-1", "socket-user-2"])
        }).pipe(Effect.provide(runtimeLayer(handled, {
          mappings: [[
            "public-key-handler-socket-success",
            "store-handler-socket-success" as EventLogServerUnencrypted.StoreId
          ]]
        })))
      })
    ))

  it.effect("makeHandler returns ErrorUnencrypted for missing mapping writes", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const handler = yield* EventLogServerUnencrypted.makeHandler
          const harness = yield* makeSocketHarness

          yield* handler(harness.socket).pipe(Effect.forkScoped)
          const hello = yield* harness.takeResponse
          assert.strictEqual(hello._tag, "Hello")

          const request = new EventLogRemote.WriteEntriesUnencrypted({
            publicKey: "missing-mapping-write",
            id: 7,
            entries: [yield* makeUserCreatedEntry("missing-user")]
          })

          yield* harness.sendRequest(request)

          const response = yield* harness.takeResponse
          assert.strictEqual(response._tag, "Error")
          if (response._tag !== "Error") {
            throw new Error("Expected Error response")
          }

          assert.strictEqual(response.requestTag, "WriteEntries")
          assert.strictEqual(response.id, request.id)
          assert.strictEqual(response.publicKey, request.publicKey)
          assert.strictEqual(response.code, "NotFound")
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("makeHandler returns ErrorUnencrypted for unauthorized writes", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])
        const layerAuthDenyWrite = Layer.succeed(
          EventLogServerUnencrypted.EventLogServerAuth,
          EventLogServerUnencrypted.EventLogServerAuth.of({
            authorizeWrite: ({ publicKey, storeId }) =>
              Effect.fail(
                new EventLogServerUnencrypted.EventLogServerAuthError({
                  reason: "Unauthorized",
                  publicKey,
                  storeId,
                  message: "write unauthorized"
                })
              ),
            authorizeRead: () => Effect.void
          })
        )

        yield* Effect.gen(function*() {
          const handler = yield* EventLogServerUnencrypted.makeHandler
          const harness = yield* makeSocketHarness

          const publicKey = "public-key-write-forbidden"

          yield* handler(harness.socket).pipe(Effect.forkScoped)
          const hello = yield* harness.takeResponse
          assert.strictEqual(hello._tag, "Hello")

          const request = new EventLogRemote.WriteEntriesUnencrypted({
            publicKey,
            id: 8,
            entries: [yield* makeUserCreatedEntry("forbidden-user")]
          })

          yield* harness.sendRequest(request)

          const response = yield* harness.takeResponse
          assert.strictEqual(response._tag, "Error")
          if (response._tag !== "Error") {
            throw new Error("Expected Error response")
          }

          assert.strictEqual(response.requestTag, "WriteEntries")
          assert.strictEqual(response.id, request.id)
          assert.strictEqual(response.publicKey, request.publicKey)
          assert.strictEqual(response.code, "Unauthorized")
        }).pipe(Effect.provide(runtimeLayerWithAuth({
          handled,
          authLayer: layerAuthDenyWrite,
          storeMappingOptions: {
            mappings: [[
              "public-key-write-forbidden",
              "store-write-forbidden" as EventLogServerUnencrypted.StoreId
            ]]
          }
        })))
      })
    ))

  it.effect("makeHandler returns ErrorUnencrypted for missing mapping RequestChanges", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const handler = yield* EventLogServerUnencrypted.makeHandler
          const harness = yield* makeSocketHarness

          yield* handler(harness.socket).pipe(Effect.forkScoped)
          const hello = yield* harness.takeResponse
          assert.strictEqual(hello._tag, "Hello")

          yield* harness.sendRequest(
            new EventLogRemote.RequestChanges({
              publicKey: "missing-mapping-read",
              startSequence: 0
            })
          )

          const response = yield* harness.takeResponse
          assert.strictEqual(response._tag, "Error")
          if (response._tag !== "Error") {
            throw new Error("Expected Error response")
          }
          assert.strictEqual(response.requestTag, "RequestChanges")
          assert.strictEqual(response.publicKey, "missing-mapping-read")
          assert.strictEqual(response.code, "NotFound")
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("makeHandler returns ErrorUnencrypted for unauthorized RequestChanges", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])
        const layerAuthDenyRead = Layer.succeed(
          EventLogServerUnencrypted.EventLogServerAuth,
          EventLogServerUnencrypted.EventLogServerAuth.of({
            authorizeWrite: () => Effect.void,
            authorizeRead: ({ publicKey, storeId }) =>
              Effect.fail(
                new EventLogServerUnencrypted.EventLogServerAuthError({
                  reason: "Forbidden",
                  publicKey,
                  storeId,
                  message: "read forbidden"
                })
              )
          })
        )

        yield* Effect.gen(function*() {
          const handler = yield* EventLogServerUnencrypted.makeHandler
          const harness = yield* makeSocketHarness

          const publicKey = "public-key-read-forbidden"

          yield* handler(harness.socket).pipe(Effect.forkScoped)
          const hello = yield* harness.takeResponse
          assert.strictEqual(hello._tag, "Hello")

          yield* harness.sendRequest(
            new EventLogRemote.RequestChanges({
              publicKey,
              startSequence: 0
            })
          )

          const response = yield* harness.takeResponse
          assert.strictEqual(response._tag, "Error")
          if (response._tag !== "Error") {
            throw new Error("Expected Error response")
          }
          assert.strictEqual(response.requestTag, "RequestChanges")
          assert.strictEqual(response.publicKey, publicKey)
          assert.strictEqual(response.code, "Forbidden")
        }).pipe(Effect.provide(runtimeLayerWithAuth({
          handled,
          authLayer: layerAuthDenyRead,
          storeMappingOptions: {
            mappings: [[
              "public-key-read-forbidden",
              "store-read-forbidden" as EventLogServerUnencrypted.StoreId
            ]]
          }
        })))
      })
    ))

  it.effect("makeHandlerHttp upgrades requests through the websocket handler", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])

        yield* Effect.gen(function*() {
          const httpHandler = yield* EventLogServerUnencrypted.makeHandlerHttp
          let upgraded = 0
          let ran = 0

          const socket: Socket.Socket = {
            [Socket.TypeId]: Socket.TypeId,
            run: () =>
              Effect.sync(() => {
                ran++
              }),
            runRaw: () =>
              Effect.sync(() => {
                ran++
              }),
            writer: Effect.succeed(() => Effect.void)
          }

          const request = {
            upgrade: Effect.sync(() => {
              upgraded++
              return socket
            })
          } as unknown as HttpServerRequest.HttpServerRequest

          const response = yield* httpHandler.pipe(
            Effect.provideService(HttpServerRequest.HttpServerRequest, request)
          )

          assert.strictEqual(upgraded, 1)
          assert.strictEqual(ran, 1)
          assert.strictEqual(response.status, 204)
        }).pipe(Effect.provide(runtimeLayer(handled)))
      })
    ))

  it.effect("layerStoreMappingResolver resolves dynamically for ingest calls", () =>
    Effect.gen(function*() {
      const handled = yield* Ref.make<ReadonlyArray<string>>([])
      const storeA = "store-resolver-a" as EventLogServerUnencrypted.StoreId
      const storeB = "store-resolver-b" as EventLogServerUnencrypted.StoreId
      const currentStore = yield* Ref.make<EventLogServerUnencrypted.StoreId>(storeA)

      const dynamicMappingLayer = EventLogServerUnencrypted.layerStoreMappingResolver({
        resolve: Effect.fnUntraced(function*(publicKey: string) {
          if (publicKey !== "dynamic-public-key") {
            return yield* new EventLogServerUnencrypted.EventLogServerStoreError({
              reason: "NotFound",
              publicKey,
              message: `No store mapping found for public key: ${publicKey}`
            })
          }

          return yield* Ref.get(currentStore)
        }),
        hasStore: Effect.fnUntraced(function*(storeId: EventLogServerUnencrypted.StoreId) {
          return storeId === storeA || storeId === storeB
        })
      })

      yield* Effect.gen(function*() {
        const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

        const first = yield* runtime.ingest({
          publicKey: "dynamic-public-key",
          entries: [yield* makeUserCreatedEntry("resolver-user-a")]
        })
        assert.strictEqual(first.storeId, storeA)

        yield* Ref.set(currentStore, storeB)

        const second = yield* runtime.ingest({
          publicKey: "dynamic-public-key",
          entries: [yield* makeUserCreatedEntry("resolver-user-b")]
        })
        assert.strictEqual(second.storeId, storeB)
      }).pipe(Effect.provide(runtimeLayerWithStoreMapping({
        handled,
        storeMappingLayer: dynamicMappingLayer
      })))
    }))

  it.effect("layerStoreMappingResolver propagates resolver failures as EventLogServerStoreError", () =>
    Effect.gen(function*() {
      const handled = yield* Ref.make<ReadonlyArray<string>>([])
      const resolverError = new EventLogServerUnencrypted.EventLogServerStoreError({
        reason: "PersistenceFailure",
        publicKey: "resolver-failing-key",
        message: "resolver backend is unavailable"
      })

      const error = yield* Effect.flip(
        Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

          yield* runtime.ingest({
            publicKey: "resolver-failing-key",
            entries: [yield* makeUserCreatedEntry("resolver-failure")]
          })
        }).pipe(
          Effect.provide(runtimeLayerWithStoreMapping({
            handled,
            storeMappingLayer: EventLogServerUnencrypted.layerStoreMappingResolver({
              resolve: Effect.fnUntraced(function*() {
                return yield* resolverError
              }),
              hasStore: Effect.fnUntraced(function*() {
                return false
              })
            })
          }))
        )
      )

      assert.instanceOf(error, EventLogServerUnencrypted.EventLogServerStoreError)
      assert.strictEqual(error.reason, "PersistenceFailure")
      assert.strictEqual(error.publicKey, "resolver-failing-key")
      assert.strictEqual(error.message, "resolver backend is unavailable")
    }))

  it.effect("layerStoreMappingStatic resolves all public keys to one shared store and hasStore gates server writes", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handled = yield* Ref.make<ReadonlyArray<string>>([])
        const sharedStore = "store-static-shared" as EventLogServerUnencrypted.StoreId
        const unknownStore = "store-static-unknown" as EventLogServerUnencrypted.StoreId

        yield* Effect.gen(function*() {
          const runtime = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const mapping = yield* EventLogServerUnencrypted.StoreMapping

          assert.strictEqual(yield* mapping.resolve("static-public-key-a"), sharedStore)
          assert.strictEqual(yield* mapping.resolve("static-public-key-b"), sharedStore)
          assert.strictEqual(yield* mapping.hasStore(sharedStore), true)
          assert.strictEqual(yield* mapping.hasStore(unknownStore), false)

          yield* runtime.write({
            schema,
            storeId: sharedStore,
            event: "UserCreated",
            payload: { id: "static-shared-user" }
          })

          const changesA = yield* runtime.requestChanges("static-public-key-a", 0)
          const changesB = yield* runtime.requestChanges("static-public-key-b", 0)
          const changeA = yield* Queue.take(changesA)
          const changeB = yield* Queue.take(changesB)

          assert.strictEqual(changeA.entry.primaryKey, "static-shared-user")
          assert.strictEqual(changeB.entry.primaryKey, "static-shared-user")

          const writeError = yield* Effect.flip(
            runtime.write({
              schema,
              storeId: unknownStore,
              event: "UserCreated",
              payload: { id: "static-write-denied" }
            })
          )

          assert.instanceOf(writeError, EventLogServerUnencrypted.EventLogServerStoreError)
          assert.strictEqual(writeError.reason, "NotFound")
          assert.strictEqual(writeError.storeId, unknownStore)
        }).pipe(Effect.provide(runtimeLayerWithStoreMapping({
          handled,
          storeMappingLayer: EventLogServerUnencrypted.layerStoreMappingStatic({
            storeId: sharedStore
          })
        })))
      })
    ))

  it.effect("store mapping memory resolves seeded mappings, supports shared stores, and tracks seeded stores", () =>
    Effect.gen(function*() {
      const mapping = yield* EventLogServerUnencrypted.StoreMapping
      const storeA = "store-a" as EventLogServerUnencrypted.StoreId
      const storeB = "store-b" as EventLogServerUnencrypted.StoreId
      const storeC = "store-c" as EventLogServerUnencrypted.StoreId

      const resolvedOne = yield* mapping.resolve("public-key-1")
      const resolvedTwo = yield* mapping.resolve("public-key-2")
      assert.strictEqual(resolvedOne, storeB)
      assert.strictEqual(resolvedTwo, storeA)

      assert.strictEqual(yield* mapping.hasStore(storeA), true)
      assert.strictEqual(yield* mapping.hasStore(storeB), true)
      assert.strictEqual(yield* mapping.hasStore(storeC), true)
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStoreMappingMemory({
      mappings: [
        ["public-key-1", "store-a" as EventLogServerUnencrypted.StoreId],
        ["public-key-2", "store-a" as EventLogServerUnencrypted.StoreId],
        ["public-key-1", "store-b" as EventLogServerUnencrypted.StoreId]
      ],
      stores: ["store-c" as EventLogServerUnencrypted.StoreId]
    }))))

  it.effect("store mapping resolve fails with NotFound for unknown public keys", () =>
    Effect.gen(function*() {
      const mapping = yield* EventLogServerUnencrypted.StoreMapping

      const error = yield* Effect.flip(mapping.resolve("missing-public-key"))
      assert.instanceOf(error, EventLogServerUnencrypted.EventLogServerStoreError)
      assert.strictEqual(error.reason, "NotFound")
      assert.strictEqual(error.publicKey, "missing-public-key")
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStoreMappingMemory())))

  it.effect("store transactions keep writes invisible until commit and changes stays gap-free across backlog + live", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.Storage
        const storeId = "store-transaction-visibility" as EventLogServerUnencrypted.StoreId
        const initialEntry = makeEntry("visibility-initial")

        yield* storage.write(storeId, [initialEntry])

        const changes = yield* storage.changes(storeId, 0)
        const backlog = yield* Queue.take(changes)
        assert.strictEqual(backlog.remoteSequence, 1)
        assert.strictEqual(backlog.entry.primaryKey, "visibility-initial")

        const stagedEntry = makeEntry("visibility-staged")
        const enteredTransaction = yield* Deferred.make<void>()
        const allowCommit = yield* Deferred.make<void>()

        const transactionFiber = yield* storage.withStoreTransaction(
          storeId,
          Effect.gen(function*() {
            const writeResult = yield* storage.write(storeId, [stagedEntry])
            assert.deepStrictEqual(writeResult.sequenceNumbers, [2])
            assert.deepStrictEqual(writeResult.committed.map((entry) => entry.remoteSequence), [2])

            yield* Deferred.succeed(enteredTransaction, undefined)
            yield* Deferred.await(allowCommit)
          })
        ).pipe(Effect.forkScoped)

        yield* Deferred.await(enteredTransaction)

        const beforeCommitEntries = yield* storage.entries(storeId, 0)
        assert.deepStrictEqual(beforeCommitEntries.map((entry) => entry.remoteSequence), [1])

        const beforeCommitChange = yield* Queue.poll(changes)
        assert.strictEqual(beforeCommitChange._tag, "None")

        yield* Deferred.succeed(allowCommit, undefined)
        yield* Fiber.join(transactionFiber)

        const afterCommitEntries = yield* storage.entries(storeId, 0)
        assert.deepStrictEqual(afterCommitEntries.map((entry) => entry.remoteSequence), [1, 2])

        const live = yield* Queue.take(changes)
        assert.strictEqual(live.remoteSequence, 2)
        assert.strictEqual(live.entry.primaryKey, "visibility-staged")
      }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory))
    ))

  it.effect("rolled back store transactions leave journal, dedupe state, and subscribers unchanged", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.Storage
        const storeId = "store-transaction-rollback" as EventLogServerUnencrypted.StoreId
        const entry = makeEntry("rollback-entry")
        const changes = yield* storage.changes(storeId, 0)

        const error = yield* Effect.flip(
          storage.withStoreTransaction(
            storeId,
            Effect.gen(function*() {
              const writeResult = yield* storage.write(storeId, [entry])
              assert.deepStrictEqual(writeResult.sequenceNumbers, [1])
              return yield* Effect.fail("rollback")
            })
          )
        )

        assert.strictEqual(error, "rollback")
        assert.deepStrictEqual(yield* storage.entries(storeId, 0), [])

        const noPublishedChange = yield* Queue.poll(changes)
        assert.strictEqual(noPublishedChange._tag, "None")

        const retry = yield* storage.write(storeId, [entry])
        assert.deepStrictEqual(retry.sequenceNumbers, [1])
        assert.deepStrictEqual(retry.committed.map((committed) => committed.remoteSequence), [1])

        const committedEntries = yield* storage.entries(storeId, 0)
        assert.deepStrictEqual(committedEntries.map((committed) => committed.remoteSequence), [1])
      }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory))
    ))

  it.effect("store transactions deduplicate against transaction-local staged entries", () =>
    Effect.gen(function*() {
      const storage = yield* EventLogServerUnencrypted.Storage
      const storeId = "store-transaction-dedupe" as EventLogServerUnencrypted.StoreId
      const duplicate = makeEntry("transaction-duplicate")

      const result = yield* storage.withStoreTransaction(
        storeId,
        Effect.gen(function*() {
          const firstWrite = yield* storage.write(storeId, [duplicate, duplicate])
          const secondWrite = yield* storage.write(storeId, [duplicate])

          assert.deepStrictEqual(firstWrite.sequenceNumbers, [1, 1])
          assert.deepStrictEqual(firstWrite.committed.map((entry) => entry.remoteSequence), [1])
          assert.deepStrictEqual(secondWrite.sequenceNumbers, [1])
          assert.strictEqual(secondWrite.committed.length, 0)

          const whileInTransaction = yield* storage.entries(storeId, 0)
          assert.deepStrictEqual(whileInTransaction, [])

          return {
            firstWrite,
            secondWrite
          }
        })
      )

      assert.deepStrictEqual(result.firstWrite.sequenceNumbers, [1, 1])
      assert.deepStrictEqual(result.secondWrite.sequenceNumbers, [1])

      const committed = yield* storage.entries(storeId, 0)
      assert.deepStrictEqual(committed.map((entry) => entry.remoteSequence), [1])
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory)))

  it.effect("store transaction coordination serializes same-store work and allows different stores concurrently", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.Storage
        const storeA = "store-transaction-contention-a" as EventLogServerUnencrypted.StoreId
        const storeB = "store-transaction-contention-b" as EventLogServerUnencrypted.StoreId

        const storeAFirstStarted = yield* Deferred.make<void>()
        const allowStoreAFirstCommit = yield* Deferred.make<void>()
        const storeASecondStarted = yield* Deferred.make<void>()
        const storeBStarted = yield* Deferred.make<void>()

        const storeAFirstFiber = yield* storage.withStoreTransaction(
          storeA,
          Effect.gen(function*() {
            yield* Deferred.succeed(storeAFirstStarted, undefined)
            yield* Deferred.await(allowStoreAFirstCommit)
          })
        ).pipe(Effect.forkScoped)

        yield* Deferred.await(storeAFirstStarted)

        const storeASecondFiber = yield* storage.withStoreTransaction(
          storeA,
          Deferred.succeed(storeASecondStarted, undefined)
        ).pipe(Effect.forkScoped)

        const storeBFiber = yield* storage.withStoreTransaction(
          storeB,
          Deferred.succeed(storeBStarted, undefined)
        ).pipe(Effect.forkScoped)

        yield* Deferred.await(storeBStarted)

        const storeASecondBeforeRelease = yield* Deferred.poll(storeASecondStarted)
        assert.strictEqual(storeASecondBeforeRelease._tag, "None")

        yield* Deferred.succeed(allowStoreAFirstCommit, undefined)

        yield* Deferred.await(storeASecondStarted)
        yield* Fiber.join(storeAFirstFiber)
        yield* Fiber.join(storeASecondFiber)
        yield* Fiber.join(storeBFiber)
      }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory))
    ))

  it.effect("processedSequence starts at 0 for each store", () =>
    Effect.gen(function*() {
      const storage = yield* EventLogServerUnencrypted.Storage
      const storeA = "store-processed-a" as EventLogServerUnencrypted.StoreId
      const storeB = "store-processed-b" as EventLogServerUnencrypted.StoreId

      assert.strictEqual(yield* storage.processedSequence(storeA), 0)
      assert.strictEqual(yield* storage.processedSequence(storeB), 0)
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory)))

  it.effect("markProcessed advances monotonically and is idempotent", () =>
    Effect.gen(function*() {
      const storage = yield* EventLogServerUnencrypted.Storage
      const storeId = "store-processed-monotonic" as EventLogServerUnencrypted.StoreId

      yield* storage.markProcessed(storeId, 2)
      assert.strictEqual(yield* storage.processedSequence(storeId), 2)

      yield* storage.markProcessed(storeId, 2)
      assert.strictEqual(yield* storage.processedSequence(storeId), 2)

      yield* storage.markProcessed(storeId, 1)
      assert.strictEqual(yield* storage.processedSequence(storeId), 2)

      yield* storage.markProcessed(storeId, 5)
      assert.strictEqual(yield* storage.processedSequence(storeId), 5)
    }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory)))

  it.effect("processed checkpoints coexist with entries and changes APIs", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.Storage
        const storeId = "store-processed-history" as EventLogServerUnencrypted.StoreId

        yield* storage.write(storeId, [
          makeEntry("user-1"),
          makeEntry("user-2")
        ])
        yield* storage.markProcessed(storeId, 2)

        const entries = yield* storage.entries(storeId, 0)
        assert.deepStrictEqual(entries.map((entry) => entry.remoteSequence), [1, 2])
        assert.strictEqual(yield* storage.processedSequence(storeId), 2)

        const changes = yield* storage.changes(storeId, 0)
        const backlogFirst = yield* Queue.take(changes)
        const backlogSecond = yield* Queue.take(changes)
        assert.deepStrictEqual([backlogFirst.remoteSequence, backlogSecond.remoteSequence], [1, 2])

        yield* storage.write(storeId, [makeEntry("user-3")])

        const live = yield* Queue.take(changes)
        assert.strictEqual(live.remoteSequence, 3)
      }).pipe(Effect.provide(EventLogServerUnencrypted.layerStorageMemory))
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
