import { assert, describe, it } from "@effect/vitest"
import { Deferred, Effect, Fiber, Queue } from "effect"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogEncryption from "effect/unstable/eventlog/EventLogEncryption"
import * as EventLogRemote from "effect/unstable/eventlog/EventLogRemote"
import * as Socket from "effect/unstable/socket/Socket"

const makeEntry = (options?: {
  readonly primaryKey?: string | undefined
  readonly payloadSize?: number | undefined
}): EventJournal.Entry =>
  new EventJournal.Entry({
    id: EventJournal.makeEntryIdUnsafe(),
    event: "UserCreated",
    primaryKey: options?.primaryKey ?? "user-1",
    payload: new Uint8Array(options?.payloadSize ?? 4).fill(1)
  })

const defaultStoreId = EventLog.StoreId.makeUnsafe("default")

const makeRemoteEntry = (options: {
  readonly remoteSequence: number
  readonly primaryKey: string
}): EventJournal.RemoteEntry =>
  new EventJournal.RemoteEntry({
    remoteSequence: options.remoteSequence,
    entry: makeEntry({ primaryKey: options.primaryKey })
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
    sendRaw: (data: Uint8Array) => Queue.offer(inbound, data).pipe(Effect.asVoid),
    takeRequestRaw: Queue.take(outbound)
  }
})

const makeRemoteHarnessUnencrypted = Effect.gen(function*() {
  const harness = yield* makeSocketHarness
  const hello = new EventLogRemote.Hello({
    remoteId: EventJournal.makeRemoteIdUnsafe(),
    challenge: globalThis.crypto.getRandomValues(new Uint8Array(32))
  })

  const sendResponse = (response: typeof EventLogRemote.ProtocolResponseUnencrypted.Type) =>
    EventLogRemote.encodeResponseUnencrypted(response).pipe(
      Effect.flatMap((data) => harness.sendRaw(data))
    )

  yield* sendResponse(hello)

  const remote = yield* EventLogRemote.fromSocketUnencrypted({ disablePing: true }).pipe(
    Effect.provideService(Socket.Socket, harness.socket)
  )

  return {
    remote,
    hello,
    sendResponse,
    takeRequest: harness.takeRequestRaw.pipe(Effect.flatMap(EventLogRemote.decodeRequestUnencrypted))
  }
})

const makeRemoteHarnessEncrypted = Effect.gen(function*() {
  const harness = yield* makeSocketHarness
  const hello = new EventLogRemote.Hello({
    remoteId: EventJournal.makeRemoteIdUnsafe(),
    challenge: globalThis.crypto.getRandomValues(new Uint8Array(32))
  })

  const sendResponse = (response: typeof EventLogRemote.ProtocolResponse.Type) =>
    EventLogRemote.encodeResponse(response).pipe(
      Effect.flatMap((data) => harness.sendRaw(data))
    )

  yield* sendResponse(hello)

  const remote = yield* EventLogRemote.fromSocket({ disablePing: true }).pipe(
    Effect.provideService(Socket.Socket, harness.socket),
    Effect.provide(EventLogEncryption.layerSubtle)
  )

  return {
    remote,
    hello,
    sendResponse,
    takeRequest: harness.takeRequestRaw.pipe(Effect.flatMap(EventLogRemote.decodeRequest))
  }
})

const authenticateUnencrypted = Effect.fnUntraced(function*(options: {
  readonly harness: any
  readonly publicKey: string
}): Effect.fn.Return<void> {
  const auth = yield* options.harness.takeRequest
  if (auth._tag !== "Authenticate") {
    throw new Error(`Expected Authenticate, got ${auth._tag}`)
  }
  assert.strictEqual(auth.publicKey, options.publicKey)
  assert.strictEqual(auth.algorithm, "Ed25519")
  yield* options.harness.sendResponse(new EventLogRemote.Authenticated({ publicKey: options.publicKey }))
})

const authenticateEncrypted = Effect.fnUntraced(function*(options: {
  readonly harness: any
  readonly publicKey: string
}): Effect.fn.Return<void> {
  const auth = yield* options.harness.takeRequest
  if (auth._tag !== "Authenticate") {
    throw new Error(`Expected Authenticate, got ${auth._tag}`)
  }
  assert.strictEqual(auth.publicKey, options.publicKey)
  assert.strictEqual(auth.algorithm, "Ed25519")
  yield* options.harness.sendResponse(new EventLogRemote.Authenticated({ publicKey: options.publicKey }))
})

describe("EventLogRemote", () => {
  it.effect("fromSocketUnencrypted authenticates before first write", () =>
    Effect.gen(function*() {
      const harness = yield* makeRemoteHarnessUnencrypted
      const identity = yield* EventLog.makeIdentity
      const entry = makeEntry()

      const writeFiber = yield* harness.remote.write({
        identity,
        storeId: defaultStoreId,
        entries: [entry]
      }).pipe(Effect.forkScoped)
      yield* authenticateUnencrypted({ harness, publicKey: identity.publicKey })

      const request = yield* harness.takeRequest
      if (request._tag !== "WriteEntries") {
        throw new Error(`Expected WriteEntries, got ${request._tag}`)
      }

      assert.strictEqual(request.publicKey, identity.publicKey)
      assert.strictEqual(request.storeId, defaultStoreId)
      assert.strictEqual(request.entries.length, 1)
      assert.strictEqual(request.entries[0].idString, entry.idString)

      yield* harness.sendResponse(new EventLogRemote.Ack({ id: request.id, sequenceNumbers: [1] }))
      yield* Fiber.join(writeFiber)
    }).pipe(Effect.provide(EventLogEncryption.layerSubtle)))

  it.effect("authenticate Forbidden maps to EventLogRemoteError with method authenticate", () =>
    Effect.gen(function*() {
      const harness = yield* makeRemoteHarnessUnencrypted
      const identity = yield* EventLog.makeIdentity

      const writeFiber = yield* harness.remote.write({
        identity,
        storeId: defaultStoreId,
        entries: [makeEntry()]
      }).pipe(Effect.forkScoped)
      const auth = yield* harness.takeRequest
      if (auth._tag !== "Authenticate") {
        throw new Error(`Expected Authenticate, got ${auth._tag}`)
      }

      yield* harness.sendResponse(
        new EventLogRemote.ProtocolError({
          requestTag: "Authenticate",
          publicKey: identity.publicKey,
          code: "Forbidden",
          message: "auth denied"
        })
      )

      const error = yield* Fiber.join(writeFiber).pipe(Effect.flip)
      assert.strictEqual(error._tag, "EventLogRemoteError")
      assert.strictEqual(error.method, "authenticate")
    }).pipe(Effect.provide(EventLogEncryption.layerSubtle)))

  it.effect("fromSocketUnencrypted write errors still fail pending writes", () =>
    Effect.gen(function*() {
      const harness = yield* makeRemoteHarnessUnencrypted
      const identity = yield* EventLog.makeIdentity
      const entry = makeEntry()

      const writeFiber = yield* harness.remote.write({
        identity,
        storeId: defaultStoreId,
        entries: [entry]
      }).pipe(Effect.forkScoped)
      yield* authenticateUnencrypted({ harness, publicKey: identity.publicKey })

      const request = yield* harness.takeRequest
      if (request._tag !== "WriteEntries") {
        throw new Error(`Expected WriteEntries, got ${request._tag}`)
      }

      yield* harness.sendResponse(
        new EventLogRemote.ProtocolError({
          requestTag: "WriteEntries",
          id: request.id,
          publicKey: request.publicKey,
          code: "Forbidden",
          message: "write rejected"
        })
      )

      const error = yield* Fiber.join(writeFiber).pipe(Effect.flip)
      assert.strictEqual(error._tag, "EventLogRemoteError")
      assert.strictEqual(error.method, "write")
    }).pipe(Effect.provide(EventLogEncryption.layerSubtle)))

  it.effect("fromSocketUnencrypted demultiplexes changes and request failures by (publicKey, storeId)", () =>
    Effect.gen(function*() {
      const harness = yield* makeRemoteHarnessUnencrypted
      const identity = yield* EventLog.makeIdentity
      const storeA = EventLog.StoreId.makeUnsafe("store-a")
      const storeB = EventLog.StoreId.makeUnsafe("store-b")

      const changesAFiber = yield* harness.remote.changes({
        identity,
        storeId: storeA,
        startSequence: 0
      }).pipe(Effect.forkScoped)

      yield* authenticateUnencrypted({ harness, publicKey: identity.publicKey })

      const requestA = yield* harness.takeRequest
      if (requestA._tag !== "RequestChanges") {
        throw new Error(`Expected RequestChanges, got ${requestA._tag}`)
      }
      assert.strictEqual(requestA.publicKey, identity.publicKey)
      assert.strictEqual(requestA.storeId, storeA)

      const queueA = yield* Fiber.join(changesAFiber)
      const queueB = yield* harness.remote.changes({
        identity,
        storeId: storeB,
        startSequence: 0
      })

      const requestB = yield* harness.takeRequest
      if (requestB._tag !== "RequestChanges") {
        throw new Error(`Expected RequestChanges, got ${requestB._tag}`)
      }
      assert.strictEqual(requestB.publicKey, identity.publicKey)
      assert.strictEqual(requestB.storeId, storeB)

      const entryA = makeRemoteEntry({ remoteSequence: 1, primaryKey: "user-a" })
      yield* harness.sendResponse(
        new EventLogRemote.ChangesUnencrypted({
          publicKey: identity.publicKey,
          storeId: storeA,
          entries: [entryA]
        })
      )

      const receivedA = yield* Queue.take(queueA).pipe(
        Effect.timeout("1 second")
      )
      assert.strictEqual(receivedA.entry.primaryKey, entryA.entry.primaryKey)

      yield* harness.sendResponse(
        new EventLogRemote.ProtocolError({
          requestTag: "RequestChanges",
          publicKey: identity.publicKey,
          storeId: storeA,
          code: "Forbidden",
          message: "store-a denied"
        })
      )

      const storeAError = yield* Queue.take(queueA).pipe(
        Effect.flip,
        Effect.timeout("1 second")
      )
      assert.strictEqual(storeAError._tag, "EventLogRemoteError")
      assert.strictEqual(storeAError.method, "changes")

      const entryB = makeRemoteEntry({ remoteSequence: 2, primaryKey: "user-b" })
      yield* harness.sendResponse(
        new EventLogRemote.ChangesUnencrypted({
          publicKey: identity.publicKey,
          storeId: storeB,
          entries: [entryB]
        })
      )

      const receivedB = yield* Queue.take(queueB).pipe(
        Effect.timeout("1 second")
      )
      assert.strictEqual(receivedB.entry.primaryKey, entryB.entry.primaryKey)
    }).pipe(Effect.provide(EventLogEncryption.layerSubtle)))

  it.effect("fromSocketUnencrypted finalization sends store-scoped StopChanges without affecting other stores", () =>
    Effect.gen(function*() {
      const harness = yield* makeRemoteHarnessUnencrypted
      const identity = yield* EventLog.makeIdentity
      const storeA = EventLog.StoreId.makeUnsafe("store-a")
      const storeB = EventLog.StoreId.makeUnsafe("store-b")
      const queueADeferred = yield* Deferred.make<
        Queue.Dequeue<EventJournal.RemoteEntry, EventLogRemote.EventLogRemoteError>
      >()

      const storeAFiber = yield* Effect.gen(function*() {
        const queue = yield* harness.remote.changes({
          identity,
          storeId: storeA,
          startSequence: 0
        })
        yield* Deferred.succeed(queueADeferred, queue)
        yield* Effect.never
      }).pipe(
        Effect.scoped,
        Effect.forkScoped
      )

      yield* authenticateUnencrypted({ harness, publicKey: identity.publicKey })

      const requestA = yield* harness.takeRequest
      if (requestA._tag !== "RequestChanges") {
        throw new Error(`Expected RequestChanges, got ${requestA._tag}`)
      }
      assert.strictEqual(requestA.storeId, storeA)

      yield* Deferred.await(queueADeferred)

      const queueB = yield* harness.remote.changes({
        identity,
        storeId: storeB,
        startSequence: 0
      })

      const requestB = yield* harness.takeRequest
      if (requestB._tag !== "RequestChanges") {
        throw new Error(`Expected RequestChanges, got ${requestB._tag}`)
      }
      assert.strictEqual(requestB.storeId, storeB)

      yield* Fiber.interrupt(storeAFiber)

      const stopA = yield* harness.takeRequest
      if (stopA._tag !== "StopChanges") {
        throw new Error(`Expected StopChanges, got ${stopA._tag}`)
      }
      assert.strictEqual(stopA.publicKey, identity.publicKey)
      assert.strictEqual(stopA.storeId, storeA)

      const entryB = makeRemoteEntry({ remoteSequence: 3, primaryKey: "user-b" })
      yield* harness.sendResponse(
        new EventLogRemote.ChangesUnencrypted({
          publicKey: identity.publicKey,
          storeId: storeB,
          entries: [entryB]
        })
      )

      const receivedB = yield* Queue.take(queueB)
      assert.strictEqual(receivedB.entry.primaryKey, entryB.entry.primaryKey)
    }).pipe(Effect.provide(EventLogEncryption.layerSubtle)))

  it.effect("fromSocket authenticates before encrypted write", () =>
    Effect.gen(function*() {
      const harness = yield* makeRemoteHarnessEncrypted
      const identity = yield* EventLog.makeIdentity

      const writeFiber = yield* harness.remote.write({
        identity,
        storeId: defaultStoreId,
        entries: [makeEntry()]
      }).pipe(Effect.forkScoped)
      yield* authenticateEncrypted({ harness, publicKey: identity.publicKey })

      const request = yield* harness.takeRequest
      if (request._tag !== "WriteEntries") {
        throw new Error(`Expected WriteEntries, got ${request._tag}`)
      }

      assert.strictEqual(request.publicKey, identity.publicKey)
      assert.strictEqual(request.storeId, defaultStoreId)
      assert.strictEqual(request.encryptedEntries.length, 1)

      yield* harness.sendResponse(new EventLogRemote.Ack({ id: request.id, sequenceNumbers: [1] }))
      yield* Fiber.join(writeFiber)
    }).pipe(Effect.provide(EventLogEncryption.layerSubtle)))
})
