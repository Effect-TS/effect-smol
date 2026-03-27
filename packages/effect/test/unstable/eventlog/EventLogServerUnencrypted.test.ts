import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Queue, Ref, Schema } from "effect"
import * as EventGroup from "effect/unstable/eventlog/EventGroup"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogRemote from "effect/unstable/eventlog/EventLogRemote"
import * as EventLogServerUnencrypted from "effect/unstable/eventlog/EventLogServerUnencrypted"
import * as Socket from "effect/unstable/socket/Socket"

const UserNamePayload = Schema.Struct({
  id: Schema.String,
  name: Schema.String
})

const UserEvents = EventGroup.empty.add({
  tag: "UserNameSet",
  primaryKey: (payload) => payload.id,
  payload: UserNamePayload
})

const schema = EventLog.schema(UserEvents)
const storeId = "store-1" as EventLogServerUnencrypted.StoreId
const serverWritePublicKey = `effect-eventlog-server-write:${storeId}`

type SeenWrite = {
  readonly name: string
  readonly publicKey: string
}

const UserNameSet = UserEvents.events.UserNameSet
const encodePayload = Schema.encodeUnknownEffect(UserNameSet.payloadMsgPack)
const decodePayload = Schema.decodeUnknownEffect(UserNameSet.payloadMsgPack)

const makeEntry = (options: {
  readonly id?: EventJournal.EntryId | undefined
  readonly primaryKey?: string | undefined
  readonly name: string
}) =>
  Effect.gen(function*() {
    const primaryKey = options.primaryKey ?? "user-1"
    return new EventJournal.Entry({
      id: options.id ?? EventJournal.makeEntryIdUnsafe(),
      event: "UserNameSet",
      primaryKey,
      payload: yield* encodePayload({ id: primaryKey, name: options.name })
    }, { disableChecks: true })
  })

const handlerLayer = (seen: Ref.Ref<ReadonlyArray<SeenWrite>>) =>
  EventLog.group(
    UserEvents,
    (handlers) =>
      handlers.handle("UserNameSet", ({ payload }) =>
        Effect.gen(function*() {
          const identity = yield* EventLog.Identity
          yield* Ref.update(seen, (writes) => [...writes, { name: payload.name, publicKey: identity.publicKey }])
        }))
  )

const allowAllAuthLayer = Layer.succeed(EventLogServerUnencrypted.EventLogServerAuth, {
  authorizeWrite: () => Effect.void,
  authorizeRead: () => Effect.void
})

const rejectingAuthLayer = Layer.succeed(EventLogServerUnencrypted.EventLogServerAuth, {
  authorizeWrite: ({ publicKey, storeId }) =>
    Effect.fail(
      new EventLogServerUnencrypted.EventLogServerAuthError({
        reason: "Forbidden",
        publicKey,
        storeId,
        message: "write rejected"
      })
    ),
  authorizeRead: ({ publicKey, storeId }) =>
    Effect.fail(
      new EventLogServerUnencrypted.EventLogServerAuthError({
        reason: "Unauthorized",
        publicKey,
        storeId,
        message: "read rejected"
      })
    )
})

const makeServerLayer = (
  seen: Ref.Ref<ReadonlyArray<SeenWrite>>,
  auth: Layer.Layer<EventLogServerUnencrypted.EventLogServerAuth> = allowAllAuthLayer
) =>
  EventLogServerUnencrypted.layer(schema).pipe(
    Layer.provideMerge(EventLogServerUnencrypted.layerStorageMemory),
    Layer.provideMerge(EventLogServerUnencrypted.layerStoreMappingStatic({ storeId })),
    Layer.provideMerge(auth),
    Layer.provideMerge(handlerLayer(seen))
  )

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
    takeRawResponse: Queue.take(outbound),
    takeResponse: Queue.take(outbound).pipe(Effect.flatMap(EventLogRemote.decodeResponseUnencrypted))
  }
})

describe("EventLogServerUnencrypted", () => {
  it.effect("ingest deduplicates entry ids within and across requests", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const server = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
        const entry = yield* makeEntry({ name: "Ada" })

        const first = yield* server.ingest({
          publicKey: "client-1",
          entries: [entry, entry]
        })
        const second = yield* server.ingest({
          publicKey: "client-1",
          entries: [entry]
        })

        assert.strictEqual(first.storeId, storeId)
        assert.deepStrictEqual(first.sequenceNumbers, [1, 1])
        assert.strictEqual(first.committed.length, 1)
        assert.deepStrictEqual(second.sequenceNumbers, [1])
        assert.strictEqual(second.committed.length, 0)
        assert.deepStrictEqual(yield* Ref.get(seen), [{ name: "Ada", publicKey: "client-1" }])
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("requestChanges compacts registered backlog entries", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.scoped(
        Effect.gen(function*() {
          const server = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const harness = yield* makeSocketHarness
          const handler = yield* EventLogServerUnencrypted.makeHandler

          yield* server.registerCompaction({
            events: ["UserNameSet"],
            effect: ({ entries, write }) => write(entries[entries.length - 1]!)
          })

          yield* server.write({
            schema,
            storeId,
            event: "UserNameSet",
            payload: { id: "user-1", name: "Ada" }
          })
          yield* server.write({
            schema,
            storeId,
            event: "UserNameSet",
            payload: { id: "user-1", name: "Grace" }
          })
          yield* server.write({
            schema,
            storeId,
            event: "UserNameSet",
            payload: { id: "user-1", name: "Margaret" }
          })

          yield* handler(harness.socket).pipe(Effect.forkScoped)
          yield* harness.takeResponse

          yield* harness.sendRequest(
            new EventLogRemote.RequestChanges({
              publicKey: "client-1",
              startSequence: 0
            })
          )

          const response = yield* harness.takeResponse
          if (response._tag !== "Changes") {
            throw new Error(`Expected Changes, got ${response._tag}`)
          }

          assert.strictEqual(response.entries.length, 1)
          assert.strictEqual(response.entries[0].remoteSequence, 3)
          assert.deepStrictEqual(yield* decodePayload(response.entries[0].entry.payload), {
            id: "user-1",
            name: "Margaret"
          })
          assert.deepStrictEqual(yield* Ref.get(seen), [
            { name: "Ada", publicKey: serverWritePublicKey },
            { name: "Grace", publicKey: serverWritePublicKey },
            { name: "Margaret", publicKey: serverWritePublicKey }
          ])
        }).pipe(Effect.provide(makeServerLayer(seen)))
      )
    }))

  it.effect("makeHandler acknowledges unencrypted writes", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.scoped(
        Effect.gen(function*() {
          const harness = yield* makeSocketHarness
          const handler = yield* EventLogServerUnencrypted.makeHandler

          yield* handler(harness.socket).pipe(Effect.forkScoped)

          const hello = yield* harness.takeResponse
          if (hello._tag !== "Hello") {
            throw new Error(`Expected Hello, got ${hello._tag}`)
          }

          yield* harness.sendRequest(
            new EventLogRemote.WriteEntriesUnencrypted({
              publicKey: "client-1",
              id: 1,
              entries: [yield* makeEntry({ name: "Ada" })]
            })
          )

          const response = yield* harness.takeResponse
          if (response._tag !== "Ack") {
            throw new Error(`Expected Ack, got ${response._tag}`)
          }

          assert.deepStrictEqual(response.sequenceNumbers, [1])
          assert.deepStrictEqual(yield* Ref.get(seen), [{ name: "Ada", publicKey: "client-1" }])
        }).pipe(Effect.provide(makeServerLayer(seen)))
      )
    }))

  it.effect("makeHandler returns unencrypted protocol errors for authorization failures", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.scoped(
        Effect.gen(function*() {
          const harness = yield* makeSocketHarness
          const handler = yield* EventLogServerUnencrypted.makeHandler

          yield* handler(harness.socket).pipe(Effect.forkScoped)
          yield* harness.takeResponse

          yield* harness.sendRequest(
            new EventLogRemote.WriteEntriesUnencrypted({
              publicKey: "client-1",
              id: 1,
              entries: [yield* makeEntry({ name: "Ada" })]
            })
          )

          const writeError = yield* harness.takeResponse
          if (writeError._tag !== "Error") {
            throw new Error(`Expected Error, got ${writeError._tag}`)
          }

          assert.strictEqual(writeError.requestTag, "WriteEntries")
          assert.strictEqual(writeError.code, "Forbidden")
          assert.strictEqual(writeError.message, "write rejected")

          yield* harness.sendRequest(
            new EventLogRemote.RequestChanges({
              publicKey: "client-1",
              startSequence: 0
            })
          )

          const readError = yield* harness.takeResponse
          if (readError._tag !== "Error") {
            throw new Error(`Expected Error, got ${readError._tag}`)
          }

          assert.strictEqual(readError.requestTag, "RequestChanges")
          assert.strictEqual(readError.code, "Unauthorized")
          assert.strictEqual(readError.message, "read rejected")
        }).pipe(Effect.provide(makeServerLayer(seen, rejectingAuthLayer)))
      )
    }))

  it.effect("makeHandler chunks oversized Changes responses", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.scoped(
        Effect.gen(function*() {
          const server = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
          const harness = yield* makeSocketHarness
          const handler = yield* EventLogServerUnencrypted.makeHandler

          yield* handler(harness.socket).pipe(Effect.forkScoped)
          yield* harness.takeResponse

          const largeName = "x".repeat(700_000)
          yield* server.write({
            schema,
            storeId,
            event: "UserNameSet",
            payload: { id: "user-1", name: largeName }
          })

          yield* harness.sendRequest(
            new EventLogRemote.RequestChanges({
              publicKey: "client-1",
              startSequence: 0
            })
          )

          const chunks = new Map<number, {
            readonly parts: Array<Uint8Array>
            count: number
            bytes: number
          }>()
          let chunkCount = 0
          let response: typeof EventLogRemote.ProtocolResponseUnencrypted.Type | undefined

          while (response === undefined) {
            const raw = yield* harness.takeRawResponse
            const next = yield* EventLogRemote.decodeResponseUnencrypted(raw)
            if (next._tag !== "ChunkedMessage") {
              response = next
              continue
            }
            chunkCount++
            const joined = EventLogRemote.ChunkedMessage.join(chunks, next)
            if (joined !== undefined) {
              response = yield* EventLogRemote.decodeResponseUnencrypted(joined)
            }
          }

          assert.strictEqual(chunkCount > 1, true)
          if (response._tag !== "Changes") {
            throw new Error(`Expected Changes, got ${response._tag}`)
          }

          assert.strictEqual(response.publicKey, "client-1")
          assert.strictEqual(response.entries.length, 1)
          assert.strictEqual(response.entries[0].remoteSequence, 1)
          assert.deepStrictEqual(yield* decodePayload(response.entries[0].entry.payload), {
            id: "user-1",
            name: largeName
          })
        }).pipe(Effect.provide(makeServerLayer(seen)))
      )
    }))
})
