import { assert, describe, it } from "@effect/vitest"
import { Effect, Queue } from "effect"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLogRemote from "effect/unstable/eventlog/EventLogRemote"
import * as EventLogServer from "effect/unstable/eventlog/EventLogServer"
import * as EventLogSessionAuth from "effect/unstable/eventlog/EventLogSessionAuth"
import * as Socket from "effect/unstable/socket/Socket"

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
    sendRequest: (request: typeof EventLogRemote.ProtocolRequest.Type) =>
      EventLogRemote.encodeRequest(request).pipe(
        Effect.flatMap((data) => Queue.offer(inbound, data)),
        Effect.asVoid
      ),
    takeResponse: Queue.take(outbound).pipe(Effect.flatMap(EventLogRemote.decodeResponse))
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
      throw new Error("Expected locally signed Authenticate payload to verify")
    }

    yield* EventLogSessionAuth.verifySessionAuthenticateRequest({
      remoteId: options.hello.remoteId,
      challenge: options.hello.challenge,
      challengeIssuedAtMillis: Date.now(),
      challengeAlreadyUsed: false,
      publicKey: options.publicKey,
      signingPublicKey: keyPair.signingPublicKey,
      signature,
      algorithm: "Ed25519"
    })
  }

  return new EventLogRemote.Authenticate({
    publicKey: options.publicKey,
    signingPublicKey: keyPair.signingPublicKey,
    signature,
    algorithm: "Ed25519"
  })
})

const withDateNow = <A, E, R>(
  nowMillis: number,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const original = Date.now
      Date.now = () => nowMillis
      return original
    }),
    () => effect,
    (original) =>
      Effect.sync(() => {
        Date.now = original
      })
  )

const makeWriteRequest = (publicKey: string, id: number) =>
  new EventLogRemote.WriteEntries({
    publicKey,
    id,
    iv: new Uint8Array(12),
    encryptedEntries: [
      {
        entryId: EventJournal.makeEntryIdUnsafe(),
        encryptedEntry: Uint8Array.of(1, 2, 3)
      }
    ]
  })

const serverLayer = EventLogServer.layerStorageMemory

describe("EventLogServer", () => {
  it.effect("makeHandler gates write/read/stop requests before Authenticate", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServer.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        yield* harness.sendRequest(makeWriteRequest("client-1", 1))

        const writeError = yield* harness.takeResponse
        if (writeError._tag !== "Error") {
          throw new Error(`Expected Error, got ${writeError._tag}`)
        }
        assert.strictEqual(writeError.requestTag, "WriteEntries")
        assert.strictEqual(writeError.code, "Forbidden")

        yield* harness.sendRequest(
          new EventLogRemote.RequestChanges({
            publicKey: "client-1",
            startSequence: 0
          })
        )

        const requestChangesError = yield* harness.takeResponse
        if (requestChangesError._tag !== "Error") {
          throw new Error(`Expected Error, got ${requestChangesError._tag}`)
        }
        assert.strictEqual(requestChangesError.requestTag, "RequestChanges")
        assert.strictEqual(requestChangesError.code, "Forbidden")

        yield* harness.sendRequest(
          new EventLogRemote.StopChanges({
            publicKey: "client-1"
          })
        )

        const stopChangesError = yield* harness.takeResponse
        if (stopChangesError._tag !== "Error") {
          throw new Error(`Expected Error, got ${stopChangesError._tag}`)
        }
        assert.strictEqual(stopChangesError.requestTag, "StopChanges")
        assert.strictEqual(stopChangesError.code, "Forbidden")
      }).pipe(Effect.provide(serverLayer))
    ))

  it.effect("makeHandler unlocks encrypted writes after successful Authenticate", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServer.makeHandler
        const storage = yield* EventLogServer.Storage

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

        yield* harness.sendRequest(makeWriteRequest("client-1", 1))

        const ack = yield* harness.takeResponse
        if (ack._tag !== "Ack") {
          throw new Error(`Expected Ack, got ${ack._tag}`)
        }
        assert.deepStrictEqual(ack.sequenceNumbers, [0])

        const persisted = yield* storage.entries("client-1", 0)
        assert.strictEqual(persisted.length, 1)
      }).pipe(Effect.provide(serverLayer))
    ))

  it.effect("makeHandler returns Forbidden when Authenticate signature is invalid", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServer.makeHandler

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
      }).pipe(Effect.provide(serverLayer))
    ))

  it.effect("makeHandler returns Forbidden when Authenticate challenge expires", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServer.makeHandler

        yield* handler(harness.socket).pipe(Effect.forkScoped)

        const hello = yield* harness.takeResponse
        if (hello._tag !== "Hello") {
          throw new Error(`Expected Hello, got ${hello._tag}`)
        }

        const authenticate = yield* makeAuthenticateRequest({
          hello,
          publicKey: "client-1"
        })

        const expiredNow = Date.now() + EventLogSessionAuth.SessionAuthChallengeTimeToLiveMillis + 1
        const response = yield* withDateNow(
          expiredNow,
          Effect.gen(function*() {
            yield* harness.sendRequest(authenticate)
            return yield* harness.takeResponse
          })
        )

        if (response._tag !== "Error") {
          throw new Error(`Expected Error, got ${response._tag}`)
        }

        assert.strictEqual(response.requestTag, "Authenticate")
        assert.strictEqual(response.code, "Forbidden")
      }).pipe(Effect.provide(serverLayer))
    ))

  it.effect("makeHandler returns Forbidden for post-auth publicKey mismatches", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const harness = yield* makeSocketHarness
        const handler = yield* EventLogServer.makeHandler

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

        yield* harness.sendRequest(makeWriteRequest("client-2", 1))

        const writeMismatch = yield* harness.takeResponse
        if (writeMismatch._tag !== "Error") {
          throw new Error(`Expected Error, got ${writeMismatch._tag}`)
        }
        assert.strictEqual(writeMismatch.requestTag, "WriteEntries")
        assert.strictEqual(writeMismatch.code, "Forbidden")

        yield* harness.sendRequest(
          new EventLogRemote.StopChanges({
            publicKey: "client-2"
          })
        )

        const stopMismatch = yield* harness.takeResponse
        if (stopMismatch._tag !== "Error") {
          throw new Error(`Expected Error, got ${stopMismatch._tag}`)
        }
        assert.strictEqual(stopMismatch.requestTag, "StopChanges")
        assert.strictEqual(stopMismatch.code, "Forbidden")
      }).pipe(Effect.provide(serverLayer))
    ))
})
