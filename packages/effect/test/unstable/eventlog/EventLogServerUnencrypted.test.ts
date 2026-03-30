import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Queue, Ref, Schema } from "effect"
import { Clock } from "effect/Clock"
import { TestClock } from "effect/testing/index"
import * as EventGroup from "effect/unstable/eventlog/EventGroup"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogRemote from "effect/unstable/eventlog/EventLogRemote"
import * as EventLogServerUnencrypted from "effect/unstable/eventlog/EventLogServerUnencrypted"
import * as EventLogSessionAuth from "effect/unstable/eventlog/EventLogSessionAuth"
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
const storeIdA = "store-a" as EventLog.StoreId
const storeIdB = "store-b" as EventLog.StoreId
const serverWritePublicKey = `effect-eventlog-server-write:${storeIdA}`

type SeenWrite = {
  readonly name: string
  readonly publicKey: string
}

const UserNameSet = UserEvents.events.UserNameSet
const encodePayload = Schema.encodeUnknownEffect(UserNameSet.payloadMsgPack)
const decodePayload = Schema.decodeUnknownEffect(UserNameSet.payloadMsgPack)

const makeEntry = Effect.fnUntraced(function*(options: {
  readonly id?: EventJournal.EntryId | undefined
  readonly primaryKey?: string | undefined
  readonly name: string
}) {
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
  authorizeRead: () => Effect.void,
  authorizeIdentity: () => Effect.void
})

const makeServerLayer = (
  seen: Ref.Ref<ReadonlyArray<SeenWrite>>,
  auth: Layer.Layer<EventLogServerUnencrypted.EventLogServerAuth> = allowAllAuthLayer,
  mapping: Layer.Layer<EventLogServerUnencrypted.StoreMapping> = EventLogServerUnencrypted.layerStoreMappingStatic({
    storeId: storeIdA
  })
) =>
  EventLogServerUnencrypted.layer(schema).pipe(
    Layer.provideMerge(EventLogServerUnencrypted.layerStorageMemory),
    Layer.provideMerge(mapping),
    Layer.provideMerge(auth),
    Layer.provideMerge(handlerLayer(seen))
  )

const makeServerLayerWithStorage = (options: {
  readonly seen: Ref.Ref<ReadonlyArray<SeenWrite>>
  readonly storage: EventLogServerUnencrypted.Storage["Service"]
  readonly auth?: Layer.Layer<EventLogServerUnencrypted.EventLogServerAuth> | undefined
  readonly mapping?: Layer.Layer<EventLogServerUnencrypted.StoreMapping> | undefined
}) =>
  EventLogServerUnencrypted.layer(schema).pipe(
    Layer.provideMerge(Layer.succeed(EventLogServerUnencrypted.Storage, options.storage)),
    Layer.provideMerge(options.mapping ?? EventLogServerUnencrypted.layerStoreMappingStatic({ storeId: storeIdA })),
    Layer.provideMerge(options.auth ?? allowAllAuthLayer),
    Layer.provideMerge(handlerLayer(options.seen))
  )

const makePairAwareStoreMappingLayer = (pairs: ReadonlyArray<readonly [string, EventLog.StoreId]>) => {
  const pairMap = new Map(pairs.map(([publicKey, storeId]) => [JSON.stringify([publicKey, storeId]), storeId] as const))

  return Layer.succeed(EventLogServerUnencrypted.StoreMapping, {
    resolve: (request) => {
      if (typeof request === "string") {
        const first = pairs.find(([publicKey]) => publicKey === request)
        return first === undefined
          ? Effect.fail(
            new EventLogServerUnencrypted.EventLogServerStoreError({
              reason: "NotFound",
              publicKey: request,
              message: `No store mapping found for public key: ${request}`
            })
          )
          : Effect.succeed(first[1])
      }

      const resolved = pairMap.get(JSON.stringify([request.publicKey, request.storeId]))
      return resolved === undefined
        ? Effect.fail(
          new EventLogServerUnencrypted.EventLogServerStoreError({
            reason: "NotFound",
            publicKey: request.publicKey,
            storeId: request.storeId,
            message: `No store mapping found for pair: ${request.publicKey}/${request.storeId}`
          })
        )
        : Effect.succeed(resolved)
    },
    hasStore: ({ storeId }) => Effect.succeed(pairs.some(([, candidateStoreId]) => candidateStoreId === storeId))
  })
}

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

type SessionAuthKeyPair = {
  readonly signingPublicKey: Uint8Array
  readonly signingPrivateKey: Uint8Array
}

const makeSessionAuthKeyPair = Effect.promise<SessionAuthKeyPair>(() =>
  globalThis.crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]).then((keyPair) => {
    if (!("privateKey" in keyPair) || !("publicKey" in keyPair)) {
      throw new Error("Expected Ed25519 CryptoKeyPair")
    }

    return Promise.all([
      globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey),
      globalThis.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
    ]).then(([signingPublicKey, signingPrivateKey]) => ({
      signingPublicKey: new Uint8Array(signingPublicKey),
      signingPrivateKey: new Uint8Array(signingPrivateKey)
    }))
  })
)

const makeAuthenticateRequest = Effect.fnUntraced(function*(options: {
  readonly hello: EventLogRemote.Hello
  readonly publicKey: string
  readonly keyPair?: SessionAuthKeyPair | undefined
  readonly signature?: Uint8Array | undefined
}) {
  const keyPair = options.keyPair ?? (yield* makeSessionAuthKeyPair)
  const signature = options.signature ?? (yield* EventLogSessionAuth.signSessionAuthPayload({
    remoteId: options.hello.remoteId,
    challenge: options.hello.challenge,
    publicKey: options.publicKey,
    signingPublicKey: keyPair.signingPublicKey,
    signingPrivateKey: keyPair.signingPrivateKey
  }))

  if (options.signature === undefined) {
    const verified = yield* EventLogSessionAuth.verifySessionAuthPayload({
      remoteId: options.hello.remoteId,
      challenge: options.hello.challenge,
      publicKey: options.publicKey,
      signingPublicKey: keyPair.signingPublicKey,
      signature
    })

    if (!verified) {
      return yield* new EventLogServerUnencrypted.EventLogServerAuthError({
        reason: "Forbidden",
        publicKey: options.publicKey,
        message: "Session auth signature verification failed"
      })
    }
  }

  return new EventLogRemote.Authenticate({
    publicKey: options.publicKey,
    signingPublicKey: keyPair.signingPublicKey,
    signature,
    algorithm: "Ed25519"
  })
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
          storeId: storeIdA,
          entries: [entry, entry]
        })
        const second = yield* server.ingest({
          publicKey: "client-1",
          storeId: storeIdA,
          entries: [entry]
        })

        assert.strictEqual(first.storeId, storeIdA)
        assert.deepStrictEqual(first.sequenceNumbers, [1, 1])
        assert.strictEqual(first.committed.length, 1)
        assert.deepStrictEqual(second.sequenceNumbers, [1])
        assert.strictEqual(second.committed.length, 0)
        assert.deepStrictEqual(yield* Ref.get(seen), [{ name: "Ada", publicKey: "client-1" }])
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("layerStoreMappingStatic rejects mismatched requested store ids", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const server = yield* EventLogServerUnencrypted.EventLogServerUnencrypted

        const ingestError = yield* server.ingest({
          publicKey: "client-1",
          storeId: storeIdB,
          entries: [yield* makeEntry({ name: "Ada" })]
        }).pipe(Effect.flip)

        assert.strictEqual(ingestError.reason, "NotFound")
        assert.strictEqual(ingestError.publicKey, "client-1")
        assert.strictEqual(ingestError.storeId, storeIdB)

        const requestChangesError = yield* server.requestChanges("client-1", storeIdB, 0).pipe(
          Effect.scoped,
          Effect.flip
        )

        assert.strictEqual(requestChangesError.reason, "NotFound")
        assert.strictEqual(requestChangesError.publicKey, "client-1")
        assert.strictEqual(requestChangesError.storeId, storeIdB)
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("ingest and requestChanges route by (publicKey, storeId)", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])
      const mapping = makePairAwareStoreMappingLayer([
        ["client-1", storeIdA],
        ["client-1", storeIdB],
        ["client-2", storeIdB]
      ])

      return yield* Effect.gen(function*() {
        const server = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
        const entryA = yield* makeEntry({ name: "Ada", primaryKey: "user-a" })
        const entryB = yield* makeEntry({ name: "Grace", primaryKey: "user-b" })

        const persistedA = yield* server.ingest({
          publicKey: "client-1",
          storeId: storeIdA,
          entries: [entryA]
        })
        const persistedB = yield* server.ingest({
          publicKey: "client-1",
          storeId: storeIdB,
          entries: [entryB]
        })

        assert.strictEqual(persistedA.storeId, storeIdA)
        assert.strictEqual(persistedB.storeId, storeIdB)

        const storeAChanges = yield* server.requestChanges("client-1", storeIdA, 0)
        const storeBChanges = yield* server.requestChanges("client-1", storeIdB, 0)
        const replayedA = yield* Queue.takeAll(storeAChanges)
        const replayedB = yield* Queue.takeAll(storeBChanges)

        assert.deepStrictEqual(replayedA.map((entry) => entry.entry.idString), [entryA.idString])
        assert.deepStrictEqual(replayedB.map((entry) => entry.entry.idString), [entryB.idString])

        const rejected = yield* server.ingest({
          publicKey: "client-2",
          storeId: storeIdA,
          entries: [yield* makeEntry({ name: "Mallory", primaryKey: "user-c" })]
        }).pipe(Effect.flip)

        assert.strictEqual(rejected.reason, "NotFound")
        assert.strictEqual(rejected.publicKey, "client-2")
        assert.strictEqual(rejected.storeId, storeIdA)
      }).pipe(Effect.provide(makeServerLayer(seen, allowAllAuthLayer, mapping)))
    }))

  it.effect("requestChanges compacts registered backlog entries", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const server = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* server.registerCompaction({
          events: ["UserNameSet"],
          effect: ({ entries, write }) => write(entries[entries.length - 1]!)
        })

        yield* server.write({
          schema,
          storeId: storeIdA,
          event: "UserNameSet",
          payload: { id: "user-1", name: "Ada" }
        })
        yield* server.write({
          schema,
          storeId: storeIdA,
          event: "UserNameSet",
          payload: { id: "user-1", name: "Grace" }
        })
        yield* server.write({
          schema,
          storeId: storeIdA,
          event: "UserNameSet",
          payload: { id: "user-1", name: "Margaret" }
        })

        yield* handler(harness.socket).pipe(Effect.forkScoped)
        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(
          yield* makeAuthenticateRequest({
            hello,
            publicKey: "client-1"
          })
        )

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }

        yield* harness.sendRequest(
          new EventLogRemote.RequestChanges({
            publicKey: "client-1",
            storeId: storeIdA,
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
    }))

  it.effect("makeHandler acknowledges unencrypted writes", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(
          yield* makeAuthenticateRequest({
            hello,
            publicKey: "client-1"
          })
        )

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }

        yield* harness.sendRequest(
          new EventLogRemote.WriteEntriesUnencrypted({
            publicKey: "client-1",
            storeId: storeIdA,
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
    }))

  it.effect("makeHandler gates write/read/stop requests before Authenticate", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
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
            storeId: storeIdA,
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
        assert.strictEqual(writeError.storeId, storeIdA)

        yield* harness.sendRequest(
          new EventLogRemote.RequestChanges({
            publicKey: "client-1",
            storeId: storeIdA,
            startSequence: 0
          })
        )

        const requestChangesError = yield* harness.takeResponse
        if (requestChangesError._tag !== "Error") {
          throw new Error(`Expected Error, got ${requestChangesError._tag}`)
        }
        assert.strictEqual(requestChangesError.requestTag, "RequestChanges")
        assert.strictEqual(requestChangesError.code, "Forbidden")
        assert.strictEqual(requestChangesError.storeId, storeIdA)

        yield* harness.sendRequest(
          new EventLogRemote.StopChanges({
            storeId: storeIdA,
            publicKey: "client-1"
          })
        )

        const stopChangesError = yield* harness.takeResponse
        if (stopChangesError._tag !== "Error") {
          throw new Error(`Expected Error, got ${stopChangesError._tag}`)
        }
        assert.strictEqual(stopChangesError.requestTag, "StopChanges")
        assert.strictEqual(stopChangesError.code, "Forbidden")
        assert.strictEqual(stopChangesError.storeId, storeIdA)
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("makeHandler unlocks requests after successful Authenticate", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        const authenticate = yield* makeAuthenticateRequest({
          hello,
          publicKey: "client-1"
        })
        yield* harness.sendRequest(authenticate)

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }
        assert.strictEqual(authenticated.publicKey, "client-1")

        yield* harness.sendRequest(
          new EventLogRemote.WriteEntriesUnencrypted({
            publicKey: "client-1",
            storeId: storeIdA,
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
    }))

  it.effect("makeHandler returns Forbidden when Authenticate signature is invalid", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        const authenticate = yield* makeAuthenticateRequest({
          hello,
          publicKey: "client-1",
          signature: new Uint8Array(EventLogSessionAuth.Ed25519SignatureLength)
        })
        yield* harness.sendRequest(authenticate)

        const response = yield* harness.takeResponse
        if (response._tag !== "Error") {
          throw new Error(`Expected Error, got ${response._tag}`)
        }

        assert.strictEqual(response.requestTag, "Authenticate")
        assert.strictEqual(response.code, "Forbidden")
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("makeHandler returns Forbidden when Authenticate challenge expires", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const clock = yield* Clock
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        const authenticate = yield* makeAuthenticateRequest({
          hello,
          publicKey: "client-1"
        })

        const expiredNow = clock.currentTimeMillisUnsafe() +
          EventLogSessionAuth.SessionAuthChallengeTimeToLiveMillis + 1
        yield* TestClock.setTime(expiredNow)
        yield* harness.sendRequest(authenticate)
        const response = yield* harness.takeResponse

        if (response._tag !== "Error") {
          throw new Error(`Expected Error, got ${response._tag}`)
        }

        assert.strictEqual(response.requestTag, "Authenticate")
        assert.strictEqual(response.code, "Forbidden")
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("makeHandler returns Forbidden for post-auth publicKey mismatches", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(
          yield* makeAuthenticateRequest({
            hello,
            publicKey: "client-1"
          })
        )

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }

        yield* harness.sendRequest(
          new EventLogRemote.WriteEntriesUnencrypted({
            publicKey: "client-2",
            storeId: storeIdA,
            id: 1,
            entries: [yield* makeEntry({ name: "Ada" })]
          })
        )

        const writeMismatch = yield* harness.takeResponse
        if (writeMismatch._tag !== "Error") {
          throw new Error(`Expected Error, got ${writeMismatch._tag}`)
        }
        assert.strictEqual(writeMismatch.requestTag, "WriteEntries")
        assert.strictEqual(writeMismatch.code, "Forbidden")
        assert.strictEqual(writeMismatch.storeId, storeIdA)

        yield* harness.sendRequest(
          new EventLogRemote.StopChanges({
            storeId: storeIdA,
            publicKey: "client-2"
          })
        )

        const stopMismatch = yield* harness.takeResponse
        if (stopMismatch._tag !== "Error") {
          throw new Error(`Expected Error, got ${stopMismatch._tag}`)
        }
        assert.strictEqual(stopMismatch.requestTag, "StopChanges")
        assert.strictEqual(stopMismatch.code, "Forbidden")
        assert.strictEqual(stopMismatch.storeId, storeIdA)
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("makeHandler reassembles chunked unencrypted write requests", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler
        const largeName = "x".repeat(700_000)
        const request = new EventLogRemote.WriteEntriesUnencrypted({
          publicKey: "client-1",
          storeId: storeIdA,
          id: 1,
          entries: [yield* makeEntry({ name: largeName })]
        })
        const encoded = yield* EventLogRemote.encodeRequestUnencrypted(request)
        const parts = EventLogRemote.ChunkedMessage.split(request.id, encoded)

        assert.strictEqual(parts.length > 1, true)

        yield* handler(harness.socket).pipe(Effect.forkScoped)
        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(
          yield* makeAuthenticateRequest({
            hello,
            publicKey: "client-1"
          })
        )

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }

        for (const part of parts) {
          yield* harness.sendRequest(part)
        }

        const response = yield* harness.takeResponse
        if (response._tag !== "Ack") {
          throw new Error(`Expected Ack, got ${response._tag}`)
        }

        assert.deepStrictEqual(response.sequenceNumbers, [1])
        assert.deepStrictEqual(yield* Ref.get(seen), [{ name: largeName, publicKey: "client-1" }])
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("makeHandler returns unencrypted protocol errors for authorization failures", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])
      const identityAuthCalls = yield* Ref.make(0)
      const authorizeReadCalls = yield* Ref.make(0)
      const authLayer = Layer.succeed(EventLogServerUnencrypted.EventLogServerAuth, {
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
          Ref.get(authorizeReadCalls).pipe(
            Effect.flatMap((calls) =>
              calls === 0
                ? Ref.update(authorizeReadCalls, (value) => value + 1)
                : Effect.fail(
                  new EventLogServerUnencrypted.EventLogServerAuthError({
                    reason: "Unauthorized",
                    publicKey,
                    storeId,
                    message: "read rejected"
                  })
                )
            )
          ),
        authorizeIdentity: ({ publicKey }) =>
          Ref.get(identityAuthCalls).pipe(
            Effect.flatMap((calls) =>
              calls === 0
                ? Ref.update(authorizeReadCalls, (value) => value + 1)
                : Effect.fail(
                  new EventLogServerUnencrypted.EventLogServerAuthError({
                    reason: "Unauthorized",
                    publicKey,
                    message: "identity rejected"
                  })
                )
            )
          )
      })

      return yield* Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)
        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(
          yield* makeAuthenticateRequest({
            hello,
            publicKey: "client-1"
          })
        )

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }

        yield* harness.sendRequest(
          new EventLogRemote.WriteEntriesUnencrypted({
            publicKey: "client-1",
            storeId: storeIdA,
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
        assert.strictEqual(writeError.storeId, storeIdA)

        yield* harness.sendRequest(
          new EventLogRemote.RequestChanges({
            publicKey: "client-1",
            storeId: storeIdA,
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
        assert.strictEqual(readError.storeId, storeIdA)
      }).pipe(Effect.provide(makeServerLayer(seen, authLayer)))
    }))

  it.effect("makeHandler chunks oversized Changes responses", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const server = yield* EventLogServerUnencrypted.EventLogServerUnencrypted
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)
        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(
          yield* makeAuthenticateRequest({
            hello,
            publicKey: "client-1"
          })
        )

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }

        const largeName = "x".repeat(700_000)
        yield* server.write({
          schema,
          storeId: storeIdA,
          event: "UserNameSet",
          payload: { id: "user-1", name: largeName }
        })

        yield* harness.sendRequest(
          new EventLogRemote.RequestChanges({
            publicKey: "client-1",
            storeId: storeIdA,
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
        assert.strictEqual(response.storeId, storeIdA)
        assert.strictEqual(response.entries.length, 1)
        assert.strictEqual(response.entries[0].remoteSequence, 1)
        assert.deepStrictEqual(yield* decodePayload(response.entries[0].entry.payload), {
          id: "user-1",
          name: largeName
        })
      }).pipe(Effect.provide(makeServerLayer(seen)))
    }))

  it.effect("makeHandler supports concurrent multi-store subscriptions and selective StopChanges", () =>
    Effect.gen(function*() {
      const harness = yield* makeSocketHarness
      const activeSubscriptions = yield* Ref.make<ReadonlyArray<string>>([])
      const scopeKey = (publicKey: string, storeId: EventLog.StoreId) => JSON.stringify([publicKey, storeId])

      const runtime = EventLogServerUnencrypted.EventLogServerUnencrypted.of({
        getId: Effect.succeed(EventJournal.makeRemoteIdUnsafe()),
        authenticateSession: () => Effect.succeed(true),
        ingest: ({ storeId }) =>
          Effect.succeed({
            storeId,
            sequenceNumbers: [] as ReadonlyArray<number>,
            committed: [] as ReadonlyArray<EventJournal.RemoteEntry>
          }),
        write: (() => Effect.void) as EventLogServerUnencrypted.EventLogServerUnencrypted["Service"]["write"],
        requestChanges: (publicKey, storeId) =>
          Effect.acquireRelease(
            Effect.gen(function*() {
              const key = scopeKey(publicKey, storeId)
              yield* Ref.update(activeSubscriptions, (keys) => keys.includes(key) ? keys : [...keys, key])
              return yield* Queue.make<EventJournal.RemoteEntry>().pipe(Effect.map(Queue.asDequeue))
            }),
            () => Ref.update(activeSubscriptions, (keys) => keys.filter((key) => key !== scopeKey(publicKey, storeId)))
          ),
        registerCompaction: () => Effect.void
      })

      return yield* Effect.gen(function*() {
        const handler = yield* EventLogServerUnencrypted.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(
          yield* makeAuthenticateRequest({
            hello,
            publicKey: "client-1"
          })
        )

        const authenticated = yield* harness.takeResponse
        if (authenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${authenticated._tag}`)
        }

        yield* harness.sendRequest(
          new EventLogRemote.RequestChanges({
            publicKey: "client-1",
            storeId: storeIdA,
            startSequence: 0
          })
        )

        yield* harness.sendRequest(
          new EventLogRemote.RequestChanges({
            publicKey: "client-1",
            storeId: storeIdB,
            startSequence: 0
          })
        )

        yield* Effect.yieldNow
        assert.deepStrictEqual(
          yield* Ref.get(activeSubscriptions),
          [scopeKey("client-1", storeIdA), scopeKey("client-1", storeIdB)]
        )

        yield* harness.sendRequest(
          new EventLogRemote.StopChanges({
            publicKey: "client-1",
            storeId: storeIdA
          })
        )

        yield* Effect.yieldNow
        assert.deepStrictEqual(
          yield* Ref.get(activeSubscriptions),
          [scopeKey("client-1", storeIdB)]
        )

        yield* harness.sendRequest(
          new EventLogRemote.StopChanges({
            publicKey: "client-1",
            storeId: storeIdB
          })
        )

        yield* Effect.yieldNow
        assert.deepStrictEqual(yield* Ref.get(activeSubscriptions), [])
      }).pipe(Effect.provideService(EventLogServerUnencrypted.EventLogServerUnencrypted, runtime))
    }))

  it.effect("makeHandler persists trusted signing keys and skips pre-bind auth read checks for known bindings", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])
      const identityAuthCalls = yield* Ref.make(0)
      const readAuthCalls = yield* Ref.make(0)
      const authLayer = Layer.succeed(EventLogServerUnencrypted.EventLogServerAuth, {
        authorizeWrite: () => Effect.void,
        authorizeRead: () => Ref.update(readAuthCalls, (calls) => calls + 1),
        authorizeIdentity: () => Ref.update(identityAuthCalls, (calls) => calls + 1)
      })

      return yield* Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const trustedKeyPair = yield* makeSessionAuthKeyPair
        const mismatchedKeyPair = yield* makeSessionAuthKeyPair

        const firstHarness = yield* makeSocketHarness
        const firstHandler = yield* EventLogServerUnencrypted.makeHandler.pipe(
          Effect.provide(makeServerLayerWithStorage({
            seen,
            storage,
            auth: authLayer
          }))
        )

        yield* firstHandler(firstHarness.socket).pipe(Effect.forkScoped)

        const firstHello = yield* firstHarness.takeResponse
        if (firstHello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${firstHello._tag}`)
        }

        yield* firstHarness.sendRequest(
          yield* makeAuthenticateRequest({
            hello: firstHello,
            publicKey: "client-1",
            keyPair: trustedKeyPair
          })
        )

        const firstAuthenticated = yield* firstHarness.takeResponse
        if (firstAuthenticated._tag !== "Authenticated") {
          throw new Error(`Expected Authenticated, got ${firstAuthenticated._tag}`)
        }

        assert.strictEqual(yield* Ref.get(identityAuthCalls), 1)

        const restartedHarness = yield* makeSocketHarness
        const restartedHandler = yield* EventLogServerUnencrypted.makeHandler.pipe(
          Effect.provide(makeServerLayerWithStorage({
            seen,
            storage,
            auth: authLayer
          }))
        )

        yield* restartedHandler(restartedHarness.socket).pipe(Effect.forkScoped)

        const restartedHello = yield* restartedHarness.takeResponse
        if (restartedHello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${restartedHello._tag}`)
        }

        yield* restartedHarness.sendRequest(
          yield* makeAuthenticateRequest({
            hello: restartedHello,
            publicKey: "client-1",
            keyPair: mismatchedKeyPair
          })
        )

        const restartedResponse = yield* restartedHarness.takeResponse
        if (restartedResponse._tag !== "Error") {
          throw new Error(`Expected Error, got ${restartedResponse._tag}`)
        }

        assert.strictEqual(restartedResponse.requestTag, "Authenticate")
        assert.strictEqual(restartedResponse.code, "Forbidden")
        assert.strictEqual(yield* Ref.get(identityAuthCalls), 1)

        const persistedBinding = yield* storage.getSessionAuthBinding("client-1")
        if (persistedBinding === undefined) {
          throw new Error("Expected persisted key binding")
        }

        assert.deepStrictEqual(persistedBinding, trustedKeyPair.signingPublicKey)
      })
    }))

  it.effect("makeHandler allows only one winner for concurrent first-bind mismatches", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<SeenWrite>>([])

      return yield* Effect.gen(function*() {
        const storage = yield* EventLogServerUnencrypted.makeStorageMemory
        const firstHarness = yield* makeSocketHarness
        const secondHarness = yield* makeSocketHarness
        const firstKeyPair = yield* makeSessionAuthKeyPair
        const secondKeyPair = yield* makeSessionAuthKeyPair

        const handler = yield* EventLogServerUnencrypted.makeHandler.pipe(
          Effect.provide(makeServerLayerWithStorage({
            seen,
            storage
          }))
        )

        yield* handler(firstHarness.socket).pipe(Effect.forkScoped)
        yield* handler(secondHarness.socket).pipe(Effect.forkScoped)

        const firstHello = yield* firstHarness.takeResponse
        const secondHello = yield* secondHarness.takeResponse
        if (firstHello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${firstHello._tag}`)
        }
        if (secondHello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${secondHello._tag}`)
        }

        yield* Effect.all([
          firstHarness.sendRequest(
            yield* makeAuthenticateRequest({
              hello: firstHello,
              publicKey: "client-1",
              keyPair: firstKeyPair
            })
          ),
          secondHarness.sendRequest(
            yield* makeAuthenticateRequest({
              hello: secondHello,
              publicKey: "client-1",
              keyPair: secondKeyPair
            })
          )
        ], { concurrency: "unbounded" })

        const [firstResponse, secondResponse] = yield* Effect.all([
          firstHarness.takeResponse,
          secondHarness.takeResponse
        ], { concurrency: "unbounded" })

        let winnerSigningPublicKey: Uint8Array | undefined

        if (firstResponse._tag === "Authenticated") {
          winnerSigningPublicKey = firstKeyPair.signingPublicKey
          assert.strictEqual(firstResponse.publicKey, "client-1")
        } else {
          if (firstResponse._tag !== "Error") {
            throw new Error(`Expected Error, got ${firstResponse._tag}`)
          }
          assert.strictEqual(firstResponse.requestTag, "Authenticate")
          assert.strictEqual(firstResponse.code, "Forbidden")
        }

        if (secondResponse._tag === "Authenticated") {
          if (winnerSigningPublicKey !== undefined) {
            throw new Error("Expected only one Authenticate winner")
          }
          winnerSigningPublicKey = secondKeyPair.signingPublicKey
          assert.strictEqual(secondResponse.publicKey, "client-1")
        } else {
          if (secondResponse._tag !== "Error") {
            throw new Error(`Expected Error, got ${secondResponse._tag}`)
          }
          assert.strictEqual(secondResponse.requestTag, "Authenticate")
          assert.strictEqual(secondResponse.code, "Forbidden")
        }

        if (winnerSigningPublicKey === undefined) {
          throw new Error("Expected one Authenticate winner")
        }

        const persistedBinding = yield* storage.getSessionAuthBinding("client-1")
        if (persistedBinding === undefined) {
          throw new Error("Expected persisted key-binding winner")
        }

        assert.deepStrictEqual(persistedBinding, winnerSigningPublicKey)
      })
    }))
})
