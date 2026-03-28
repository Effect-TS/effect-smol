import { assert, describe, it } from "@effect/vitest"
import { Effect, Fiber, Queue } from "effect"
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
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeRemoteHarnessUnencrypted
        const identity = EventLog.makeIdentityUnsafe()
        const entry = makeEntry()

        const writeFiber = yield* harness.remote.write(identity, [entry]).pipe(Effect.forkScoped)
        yield* authenticateUnencrypted({ harness, publicKey: identity.publicKey })

        const request = yield* harness.takeRequest
        if (request._tag !== "WriteEntries") {
          throw new Error(`Expected WriteEntries, got ${request._tag}`)
        }

        assert.strictEqual(request.publicKey, identity.publicKey)
        assert.strictEqual(request.entries.length, 1)
        assert.strictEqual(request.entries[0].idString, entry.idString)

        yield* harness.sendResponse(new EventLogRemote.Ack({ id: request.id, sequenceNumbers: [1] }))
        yield* Fiber.join(writeFiber)
      })
    ))

  it.effect("authenticate Forbidden maps to EventLogRemoteError with method authenticate", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeRemoteHarnessUnencrypted
        const identity = EventLog.makeIdentityUnsafe()

        const writeFiber = yield* harness.remote.write(identity, [makeEntry()]).pipe(Effect.forkScoped)
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
      })
    ))

  it.effect("fromSocketUnencrypted write errors still fail pending writes", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeRemoteHarnessUnencrypted
        const identity = EventLog.makeIdentityUnsafe()
        const entry = makeEntry()

        const writeFiber = yield* harness.remote.write(identity, [entry]).pipe(Effect.forkScoped)
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
      })
    ))

  it.effect("fromSocket authenticates before encrypted write", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeRemoteHarnessEncrypted
        const identity = EventLog.makeIdentityUnsafe()

        const writeFiber = yield* harness.remote.write(identity, [makeEntry()]).pipe(Effect.forkScoped)
        yield* authenticateEncrypted({ harness, publicKey: identity.publicKey })

        const request = yield* harness.takeRequest
        if (request._tag !== "WriteEntries") {
          throw new Error(`Expected WriteEntries, got ${request._tag}`)
        }

        assert.strictEqual(request.publicKey, identity.publicKey)
        assert.strictEqual(request.encryptedEntries.length, 1)

        yield* harness.sendResponse(new EventLogRemote.Ack({ id: request.id, sequenceNumbers: [1] }))
        yield* Fiber.join(writeFiber)
      })
    ))
})
