import { assert, describe, it } from "@effect/vitest"
import { Effect, Fiber, Queue } from "effect"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
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
    sendResponse: (response: typeof EventLogRemote.ProtocolResponseUnencrypted.Type) =>
      EventLogRemote.encodeResponseUnencrypted(response).pipe(
        Effect.flatMap((data) => Queue.offer(inbound, data)),
        Effect.asVoid
      ),
    takeRequestRaw: Queue.take(outbound)
  }
})

const makeRemoteHarness = Effect.gen(function*() {
  const harness = yield* makeSocketHarness
  const remoteId = EventJournal.makeRemoteIdUnsafe()
  yield* harness.sendResponse(new EventLogRemote.Hello({ remoteId }))
  const remote = yield* EventLogRemote.fromSocketUnencrypted({ disablePing: true }).pipe(
    Effect.provideService(Socket.Socket, harness.socket)
  )
  return { harness, remote }
})

describe("EventLogRemote", () => {
  it.effect("fromSocketUnencrypted uses unencrypted request / response codecs", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const { harness, remote } = yield* makeRemoteHarness
        const identity = EventLog.makeIdentityUnsafe()
        const entry = makeEntry()

        const writeFiber = yield* remote.write(identity, [entry]).pipe(Effect.forkScoped)
        const requestData = yield* harness.takeRequestRaw

        const request = yield* EventLogRemote.decodeRequestUnencrypted(requestData)
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

  it.effect("unencrypted write errors fail pending writes with EventLogRemoteError", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const { harness, remote } = yield* makeRemoteHarness
        const identity = EventLog.makeIdentityUnsafe()
        const entry = makeEntry()

        const writeFiber = yield* remote.write(identity, [entry]).pipe(Effect.forkScoped)
        const request = yield* harness.takeRequestRaw.pipe(Effect.flatMap(EventLogRemote.decodeRequestUnencrypted))
        if (request._tag !== "WriteEntries") {
          throw new Error(`Expected WriteEntries, got ${request._tag}`)
        }

        yield* harness.sendResponse(
          new EventLogRemote.ErrorUnencrypted({
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
        assert.strictEqual((error.cause as any)._tag, "Error")
      })
    ))

  it.effect("unencrypted RequestChanges errors fail the returned subscription queue", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const { harness, remote } = yield* makeRemoteHarness
        const identity = EventLog.makeIdentityUnsafe()

        const queue = yield* remote.changes(identity, 0)
        const request = yield* harness.takeRequestRaw.pipe(Effect.flatMap(EventLogRemote.decodeRequestUnencrypted))
        if (request._tag !== "RequestChanges") {
          throw new Error(`Expected RequestChanges, got ${request._tag}`)
        }

        yield* harness.sendResponse(
          new EventLogRemote.ErrorUnencrypted({
            requestTag: "RequestChanges",
            publicKey: identity.publicKey,
            code: "Unauthorized",
            message: "read rejected"
          })
        )

        const error = yield* Queue.takeAll(queue).pipe(Effect.flip)
        assert.strictEqual(error._tag, "EventLogRemoteError")
        assert.strictEqual(error.method, "changes")
      })
    ))

  it.effect("fromSocketUnencrypted can re-subscribe after a RequestChanges error", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const { harness, remote } = yield* makeRemoteHarness
        const identity = EventLog.makeIdentityUnsafe()

        const firstQueue = yield* remote.changes(identity, 0)
        const firstRequest = yield* harness.takeRequestRaw.pipe(Effect.flatMap(EventLogRemote.decodeRequestUnencrypted))
        if (firstRequest._tag !== "RequestChanges") {
          throw new Error(`Expected RequestChanges, got ${firstRequest._tag}`)
        }

        yield* harness.sendResponse(
          new EventLogRemote.ErrorUnencrypted({
            requestTag: "RequestChanges",
            publicKey: identity.publicKey,
            code: "Unauthorized",
            message: "read rejected"
          })
        )

        yield* Queue.takeAll(firstQueue).pipe(Effect.flip)

        const secondQueue = yield* remote.changes(identity, 0)
        const secondRequest = yield* harness.takeRequestRaw.pipe(
          Effect.flatMap(EventLogRemote.decodeRequestUnencrypted)
        )
        if (secondRequest._tag !== "RequestChanges") {
          throw new Error(`Expected RequestChanges, got ${secondRequest._tag}`)
        }

        const entry = makeEntry()
        yield* harness.sendResponse(
          new EventLogRemote.ChangesUnencrypted({
            publicKey: identity.publicKey,
            entries: [new EventJournal.RemoteEntry({ remoteSequence: 1, entry })]
          })
        )

        const changes = yield* Queue.takeAll(secondQueue)
        assert.strictEqual(changes.length, 1)
        assert.strictEqual(changes[0].entry.idString, entry.idString)
      })
    ))

  it.effect("chunked unencrypted Changes messages round-trip through fromSocketUnencrypted", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const { harness, remote } = yield* makeRemoteHarness
        const identity = EventLog.makeIdentityUnsafe()

        const queue = yield* remote.changes(identity, 0)
        yield* harness.takeRequestRaw

        const entry = makeEntry({ primaryKey: "chunked", payloadSize: 700_000 })
        const response = new EventLogRemote.ChangesUnencrypted({
          publicKey: identity.publicKey,
          entries: [new EventJournal.RemoteEntry({ remoteSequence: 42, entry })]
        })
        const encoded = yield* EventLogRemote.encodeResponseUnencrypted(response)
        const parts = EventLogRemote.ChunkedMessage.split(1, encoded)
        assert.strictEqual(parts.length > 1, true)

        for (const part of parts) {
          yield* harness.sendResponse(part)
        }

        const changes = yield* Queue.takeAll(queue)
        assert.strictEqual(changes.length, 1)
        assert.strictEqual(changes[0].remoteSequence, 42)
        assert.strictEqual(changes[0].entry.idString, entry.idString)
        assert.strictEqual(changes[0].entry.payload.byteLength, entry.payload.byteLength)
      })
    ))
})
