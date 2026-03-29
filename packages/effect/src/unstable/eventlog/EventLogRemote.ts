/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"
import * as Deferred from "../../Deferred.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Layer from "../../Layer.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schedule from "../../Schedule.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Msgpack from "../encoding/Msgpack.ts"
import * as Socket from "../socket/Socket.ts"
import { Entry, EntryId, RemoteEntry, RemoteId } from "./EventJournal.ts"
import { type Identity, StoreId } from "./EventLog.ts"
import { EncryptedEntry, EncryptedRemoteEntry, EventLogEncryption, layerSubtle } from "./EventLogEncryption.ts"
import { encodeSessionAuthPayload, signSessionAuthPayloadBytes } from "./EventLogSessionAuth.ts"

/**
 * @since 4.0.0
 * @category models
 */
export class EventLogRemote extends ServiceMap.Service<EventLogRemote, {
  readonly id: RemoteId
  readonly changes: (options: {
    readonly identity: Identity["Service"]
    readonly storeId: StoreId
    readonly startSequence: number
  }) => Effect.Effect<Queue.Dequeue<RemoteEntry, EventLogRemoteError>, never, Scope.Scope>
  readonly write: (options: {
    readonly identity: Identity["Service"]
    readonly storeId: StoreId
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<void, EventLogRemoteError>
}>()("effect/eventlog/EventLogRemote") {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Hello extends Schema.Class<Hello>("effect/eventlog/EventLogRemote/Hello")({
  _tag: Schema.tag("Hello"),
  remoteId: RemoteId,
  challenge: Schema.Uint8Array
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Authenticate extends Schema.Class<Authenticate>("effect/eventlog/EventLogRemote/Authenticate")({
  _tag: Schema.tag("Authenticate"),
  publicKey: Schema.String,
  signingPublicKey: Schema.Uint8Array,
  signature: Schema.Uint8Array,
  algorithm: Schema.Literal("Ed25519")
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Authenticated extends Schema.Class<Authenticated>("effect/eventlog/EventLogRemote/Authenticated")({
  _tag: Schema.tag("Authenticated"),
  publicKey: Schema.String
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class ChunkedMessage extends Schema.Class<ChunkedMessage>("effect/eventlog/EventLogRemote/ChunkedMessage")({
  _tag: Schema.tag("ChunkedMessage"),
  id: Schema.Number,
  part: Schema.Tuple([Schema.Number, Schema.Number]),
  data: Schema.Uint8Array
}) {
  /**
   * @since 4.0.0
   */
  static split(id: number, data: Uint8Array): ReadonlyArray<ChunkedMessage> {
    const parts = Math.ceil(data.byteLength / constChunkSize)
    const result: Array<ChunkedMessage> = new Array(parts)
    for (let i = 0; i < parts; i++) {
      const start = i * constChunkSize
      const end = Math.min((i + 1) * constChunkSize, data.byteLength)
      result[i] = new ChunkedMessage({
        _tag: "ChunkedMessage",
        id,
        part: [i, parts],
        data: data.subarray(start, end)
      })
    }
    return result
  }

  /**
   * @since 4.0.0
   */
  static join(
    map: Map<number, {
      readonly parts: Array<Uint8Array>
      count: number
      bytes: number
    }>,
    part: ChunkedMessage
  ): Uint8Array | undefined {
    const [index, total] = part.part
    let entry = map.get(part.id)
    if (!entry) {
      entry = {
        parts: new Array(total),
        count: 0,
        bytes: 0
      }
      map.set(part.id, entry)
    }
    entry.parts[index] = part.data
    entry.count++
    entry.bytes += part.data.byteLength
    if (entry.count !== total) {
      return
    }
    const data = new Uint8Array(entry.bytes)
    let offset = 0
    for (const part of entry.parts) {
      data.set(part, offset)
      offset += part.byteLength
    }
    map.delete(part.id)
    return data
  }
}

/**
 * @since 4.0.0
 * @category protocol
 */
export class WriteEntries extends Schema.Class<WriteEntries>("effect/eventlog/EventLogRemote/WriteEntries")({
  _tag: Schema.tag("WriteEntries"),
  publicKey: Schema.String,
  storeId: StoreId,
  id: Schema.Number,
  iv: Schema.Uint8Array,
  encryptedEntries: Schema.Array(EncryptedEntry)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class WriteEntriesUnencrypted extends Schema.Class<WriteEntriesUnencrypted>(
  "effect/eventlog/EventLogRemote/WriteEntriesUnencrypted"
)({
  _tag: Schema.tag("WriteEntries"),
  publicKey: Schema.String,
  storeId: StoreId,
  id: Schema.Number,
  entries: Schema.Array(Entry)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Ack extends Schema.Class<Ack>("effect/eventlog/EventLogRemote/Ack")({
  _tag: Schema.tag("Ack"),
  id: Schema.Number,
  sequenceNumbers: Schema.Array(Schema.Number)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class RequestChanges extends Schema.Class<RequestChanges>("effect/eventlog/EventLogRemote/RequestChanges")({
  _tag: Schema.tag("RequestChanges"),
  publicKey: Schema.String,
  storeId: StoreId,
  startSequence: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Changes extends Schema.Class<Changes>("effect/eventlog/EventLogRemote/Changes")({
  _tag: Schema.tag("Changes"),
  publicKey: Schema.String,
  storeId: StoreId,
  entries: Schema.Array(EncryptedRemoteEntry)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class ChangesUnencrypted extends Schema.Class<ChangesUnencrypted>(
  "effect/eventlog/EventLogRemote/ChangesUnencrypted"
)({
  _tag: Schema.tag("Changes"),
  publicKey: Schema.String,
  storeId: StoreId,
  entries: Schema.Array(RemoteEntry)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class StopChanges extends Schema.Class<StopChanges>("effect/eventlog/EventLogRemote/StopChanges")({
  _tag: Schema.tag("StopChanges"),
  storeId: StoreId,
  publicKey: Schema.String
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Ping extends Schema.Class<Ping>("effect/eventlog/EventLogRemote/Ping")({
  _tag: Schema.tag("Ping"),
  id: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Pong extends Schema.Class<Pong>("effect/eventlog/EventLogRemote/Pong")({
  _tag: Schema.tag("Pong"),
  id: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class ProtocolError extends Schema.Class<ProtocolError>(
  "effect/eventlog/EventLogRemote/ProtocolError"
)({
  _tag: Schema.tag("Error"),
  requestTag: Schema.String,
  id: Schema.optional(Schema.Number),
  publicKey: Schema.optional(Schema.String),
  storeId: Schema.optional(StoreId),
  code: Schema.Literals(["Unauthorized", "Forbidden", "NotFound", "InvalidRequest", "InternalServerError"]),
  message: Schema.String
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolRequest = Schema.Union([
  Authenticate,
  WriteEntries,
  RequestChanges,
  StopChanges,
  ChunkedMessage,
  Ping
])

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolRequestUnencrypted = Schema.Union([
  Authenticate,
  WriteEntriesUnencrypted,
  RequestChanges,
  StopChanges,
  ChunkedMessage,
  Ping
])

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolRequestMsgpack = Msgpack.schema(ProtocolRequest)

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolRequestUnencryptedMsgpack = Msgpack.schema(ProtocolRequestUnencrypted)

/**
 * @since 4.0.0
 * @category protocol
 */
export const decodeRequest = Schema.decodeUnknownEffect(ProtocolRequestMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const encodeRequest = Schema.encodeUnknownEffect(ProtocolRequestMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const decodeRequestUnencrypted = Schema.decodeUnknownEffect(ProtocolRequestUnencryptedMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const encodeRequestUnencrypted = Schema.encodeUnknownEffect(ProtocolRequestUnencryptedMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolResponse = Schema.Union([Hello, Authenticated, Ack, Changes, ChunkedMessage, Pong, ProtocolError])

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolResponseMsgpack = Msgpack.schema(ProtocolResponse)

/**
 * @since 4.0.0
 * @category protocol
 */
export const decodeResponse = Schema.decodeUnknownEffect(ProtocolResponseMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const encodeResponse = Schema.encodeUnknownEffect(ProtocolResponseMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolResponseUnencrypted = Schema.Union([
  Hello,
  Authenticated,
  Ack,
  ChangesUnencrypted,
  ChunkedMessage,
  Pong,
  ProtocolError
])

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolResponseUnencryptedMsgpack = Msgpack.schema(ProtocolResponseUnencrypted)

/**
 * @since 4.0.0
 * @category protocol
 */
export const decodeResponseUnencrypted = Schema.decodeUnknownEffect(ProtocolResponseUnencryptedMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const encodeResponseUnencrypted = Schema.encodeUnknownEffect(ProtocolResponseUnencryptedMsgpack)

/**
 * @since 4.0.0
 * @category change
 */
export class RemoteAdditions extends Schema.Class<RemoteAdditions>("effect/eventlog/EventLogRemote/RemoteAdditions")({
  _tag: Schema.tag("RemoteAdditions"),
  entries: Schema.Array(RemoteEntry)
}) {}

const constChunkSize = 512_000

/**
 * @since 4.0.0
 * @category errors
 */
export class EventLogRemoteError extends Data.TaggedError("EventLogRemoteError")<{
  readonly method: string
  readonly cause: unknown
}> {}

const makeRemoteError = (method: string, cause: unknown): EventLogRemoteError =>
  new EventLogRemoteError({
    method,
    cause
  })

const makeAuthenticateError = (cause: unknown): EventLogRemoteError => makeRemoteError("authenticate", cause)

const makeSessionResetError = () =>
  makeAuthenticateError(
    new Error("Authentication session reset after receiving a new Hello challenge")
  )

const makeSessionAuth = (options: {
  readonly writeAuthenticate: (request: Authenticate) => Effect.Effect<void, unknown>
}) => {
  let latestRemoteId: RemoteId | undefined
  let latestChallenge: Uint8Array | undefined
  let authenticatedPublicKey: string | undefined
  let failedAuthenticate: EventLogRemoteError | undefined
  let inFlightAuthenticate: {
    readonly publicKey: string
    readonly deferred: Deferred.Deferred<void, EventLogRemoteError>
  } | undefined

  const failInFlightAuthenticate = (error: EventLogRemoteError) => {
    const inFlight = inFlightAuthenticate
    inFlightAuthenticate = undefined
    if (inFlight === undefined) {
      return Effect.void
    }
    return Deferred.fail(inFlight.deferred, error).pipe(Effect.asVoid)
  }

  return {
    onHello: (hello: Hello) =>
      Effect.suspend(() => {
        latestRemoteId = hello.remoteId
        latestChallenge = hello.challenge
        authenticatedPublicKey = undefined
        failedAuthenticate = undefined
        return failInFlightAuthenticate(makeSessionResetError())
      }),
    onAuthenticated: (response: Authenticated) =>
      Effect.suspend(() => {
        const inFlight = inFlightAuthenticate
        if (inFlight === undefined) {
          return Effect.void
        }
        if (response.publicKey !== inFlight.publicKey) {
          const error = makeAuthenticateError(
            new Error(
              `Authenticate response publicKey mismatch: expected ${inFlight.publicKey}, got ${response.publicKey}`
            )
          )
          failedAuthenticate = error
          return Deferred.fail(inFlight.deferred, error).pipe(Effect.asVoid)
        }
        authenticatedPublicKey = response.publicKey
        failedAuthenticate = undefined
        return Deferred.succeed(inFlight.deferred, void 0).pipe(Effect.asVoid)
      }),
    onAuthenticateError: (error: ProtocolError) =>
      Effect.suspend(() => {
        const mapped = makeAuthenticateError(error)
        if (error.code === "Forbidden") {
          failedAuthenticate = mapped
        }
        const inFlight = inFlightAuthenticate
        if (inFlight === undefined) {
          return Effect.void
        }
        return Deferred.fail(inFlight.deferred, mapped).pipe(Effect.asVoid)
      }),
    ensureAuthenticated: Effect.fnUntraced(function*(identity: Identity["Service"]) {
      if (authenticatedPublicKey !== undefined) {
        if (authenticatedPublicKey === identity.publicKey) {
          return
        }
        return yield* makeAuthenticateError(
          new Error(
            `Socket session already authenticated for publicKey: ${authenticatedPublicKey}`
          )
        )
      }

      if (failedAuthenticate !== undefined) {
        return yield* failedAuthenticate
      }

      const inFlight = inFlightAuthenticate
      if (inFlight !== undefined) {
        if (inFlight.publicKey === identity.publicKey) {
          return yield* Deferred.await(inFlight.deferred)
        }
        return yield* makeAuthenticateError(
          new Error(
            `Concurrent socket authentication conflict: in-flight for ${inFlight.publicKey}, received ${identity.publicKey}`
          )
        )
      }

      if (latestRemoteId === undefined || latestChallenge === undefined) {
        return yield* makeAuthenticateError(
          new Error("Cannot authenticate before receiving Hello(remoteId, challenge)")
        )
      }

      const deferred = yield* Deferred.make<void, EventLogRemoteError>()
      const currentRemoteId = latestRemoteId!
      const currentChallenge = latestChallenge!
      const currentIdentity = identity.publicKey
      inFlightAuthenticate = {
        publicKey: currentIdentity,
        deferred
      }

      const authenticateAttempt = Effect.gen(function*() {
        const payload = yield* encodeSessionAuthPayload({
          remoteId: currentRemoteId,
          challenge: currentChallenge,
          publicKey: currentIdentity,
          signingPublicKey: identity.signingPublicKey
        })
        const signature = yield* signSessionAuthPayloadBytes({
          payload,
          signingPrivateKey: Redacted.value(identity.signingPrivateKey)
        })

        if (inFlightAuthenticate?.deferred !== deferred) {
          return yield* Deferred.await(deferred)
        }

        yield* options.writeAuthenticate(
          new Authenticate({
            publicKey: currentIdentity,
            signingPublicKey: identity.signingPublicKey,
            signature,
            algorithm: "Ed25519"
          })
        ).pipe(
          Effect.mapError(makeAuthenticateError)
        )

        yield* Deferred.await(deferred)
      }).pipe(
        Effect.mapError(makeAuthenticateError),
        Effect.catch((error) =>
          Deferred.fail(deferred, error).pipe(
            Effect.andThen(Effect.fail(error))
          )
        ),
        Effect.ensuring(
          Effect.sync(() => {
            if (inFlightAuthenticate?.deferred === deferred) {
              inFlightAuthenticate = undefined
            }
          })
        )
      )

      return yield* authenticateAttempt
    }),
    isAuthenticated: (publicKey: string): boolean => authenticatedPublicKey === publicKey
  }
}

/**
 * @since 4.0.0
 * @category entry
 */
export const RemoteEntryChange = Schema.Tuple([RemoteId, Schema.Array(EntryId)])

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromSocket = Effect.fnUntraced(function*(options?: {
  readonly disablePing?: boolean | undefined
}): Effect.fn.Return<EventLogRemote["Service"], never, Scope.Scope | EventLogEncryption | Socket.Socket> {
  const socket = yield* Socket.Socket
  const encryption = yield* EventLogEncryption
  const writeRaw = yield* socket.writer

  const writeRequest = (request: typeof ProtocolRequest.Type) =>
    Effect.gen(function*() {
      const data = yield* encodeRequest(request)
      if (request._tag !== "WriteEntries" || data.byteLength <= constChunkSize) {
        return yield* writeRaw(data)
      }
      const id = request.id
      for (const part of ChunkedMessage.split(id, data)) {
        yield* writeRaw(yield* encodeRequest(part))
      }
    })

  const sessionAuth = makeSessionAuth({
    writeAuthenticate: writeRequest
  })

  let pendingCounter = 0
  const pending = new Map<number, {
    readonly entries: ReadonlyArray<Entry>
    readonly deferred: Deferred.Deferred<void, EventLogRemoteError>
    readonly publicKey: string
    readonly storeId: StoreId
  }>()
  const chunks = new Map<number, {
    readonly parts: Array<Uint8Array>
    count: number
    bytes: number
  }>()

  const subscriptions = yield* RcMap.make({
    lookup: (options: {
      readonly publicKey: string
      readonly storeId: StoreId
    }) =>
      Effect.acquireRelease(
        Queue.make<RemoteEntry, EventLogRemoteError>(),
        (queue) =>
          Queue.shutdown(queue).pipe(
            Effect.andThen(
              Effect.suspend(() =>
                sessionAuth.isAuthenticated(options.publicKey)
                  ? Effect.ignore(writeRequest(
                    new StopChanges(options)
                  ))
                  : Effect.void
              )
            )
          )
      )
  })
  const identities = new Map<string, Identity["Service"]>()
  const badPing = yield* Deferred.make<never, Error>()
  const remoteId = yield* Deferred.make<RemoteId>()

  let latestPing = 0
  let latestPong = 0

  if (options?.disablePing !== true) {
    yield* Effect.suspend(() => {
      if (latestPing !== latestPong) {
        return Deferred.fail(badPing, new Error("Ping timeout"))
      }
      return writeRequest(new Ping({ id: ++latestPing }))
    }).pipe(
      Effect.delay("10 seconds"),
      Effect.ignore,
      Effect.forever,
      Effect.forkScoped
    )
  }

  const handleMessage = Effect.fnUntraced(
    function*(res: typeof ProtocolResponse.Type): Effect.fn.Return<void, Schema.SchemaError, Scope.Scope> {
      switch (res._tag) {
        case "Hello": {
          yield* sessionAuth.onHello(res)
          yield* Deferred.succeed(remoteId, res.remoteId)
          return
        }
        case "Authenticated": {
          return yield* sessionAuth.onAuthenticated(res)
        }
        case "Ack": {
          const entry = pending.get(res.id)
          if (!entry) return
          pending.delete(res.id)
          const { deferred, entries, publicKey, storeId } = entry
          const remoteEntries = res.sequenceNumbers.map((sequenceNumber, i) => {
            const entry = entries[i]
            return new RemoteEntry({
              remoteSequence: sequenceNumber,
              entry
            })
          })
          const queue = yield* RcMap.get(subscriptions, { publicKey, storeId })
          yield* Queue.offerAll(queue, remoteEntries)
          yield* Deferred.done(deferred, Exit.void)
          return
        }
        case "Pong": {
          latestPong = res.id
          if (res.id === latestPing) {
            return
          }
          yield* Deferred.fail(badPing, new Error("Pong id mismatch"))
          return
        }
        case "Changes": {
          const queue = yield* RcMap.get(subscriptions, { publicKey: res.publicKey, storeId: res.storeId })
          const identity = identities.get(res.publicKey)
          if (!identity) {
            return
          }
          const entries = yield* encryption.decrypt(identity, res.entries)
          yield* Queue.offerAll(queue, entries)
          return
        }
        case "ChunkedMessage": {
          const data = ChunkedMessage.join(chunks, res)
          if (!data) return
          const decoded = yield* decodeResponse(data)
          return yield* handleMessage(decoded)
        }
        case "Error": {
          if (res.requestTag === "Authenticate") {
            return yield* sessionAuth.onAuthenticateError(res)
          }
          if (res.requestTag === "WriteEntries" && res.id !== undefined) {
            const entry = pending.get(res.id)
            if (!entry) {
              return
            }
            pending.delete(res.id)
            yield* Deferred.fail(
              entry.deferred,
              makeRemoteError("write", res)
            )
            return
          }
          if (res.requestTag === "RequestChanges" && res.publicKey !== undefined && res.storeId !== undefined) {
            const key = { publicKey: res.publicKey, storeId: res.storeId }
            const hasSubscription = yield* RcMap.has(subscriptions, key)
            if (!hasSubscription) {
              return
            }
            const queue = yield* RcMap.get(subscriptions, key)
            identities.delete(res.publicKey)
            yield* RcMap.invalidate(subscriptions, key)
            yield* Queue.fail(
              queue,
              makeRemoteError("changes", res)
            )
            return
          }
          return
        }
      }
    },
    Effect.scoped
  )

  yield* socket.run((data) => Effect.flatMap(decodeResponse(data), handleMessage)).pipe(
    Effect.raceFirst(Deferred.await(badPing)),
    Effect.tapCause(Effect.logDebug),
    Effect.retry({
      schedule: Schedule.exponential(100).pipe(
        Schedule.either(Schedule.spaced(5000))
      )
    }),
    Effect.annotateLogs({
      service: "EventLogRemote",
      method: "fromSocket"
    }),
    Effect.forkScoped
  )

  const id = yield* Deferred.await(remoteId)

  return {
    id,
    write: Effect.fnUntraced(function*(options) {
      yield* sessionAuth.ensureAuthenticated(options.identity).pipe(
        Effect.mapError((cause) => makeRemoteError("authenticate", cause))
      )
      const encrypted = yield* encryption.encrypt(options.identity, options.entries)
      const deferred = yield* Deferred.make<void, EventLogRemoteError>()
      const id = pendingCounter++
      pending.set(id, {
        entries: options.entries,
        deferred,
        publicKey: options.identity.publicKey,
        storeId: options.storeId
      })
      yield* Effect.orDie(writeRequest(
        new WriteEntries({
          publicKey: options.identity.publicKey,
          storeId: options.storeId,
          id,
          iv: encrypted.iv,
          encryptedEntries: encrypted.encryptedEntries.map((encryptedEntry, i) => ({
            entryId: options.entries[i].id,
            encryptedEntry
          }))
        })
      ))
      yield* Deferred.await(deferred)
    }),
    changes: Effect.fnUntraced(function*({ identity, storeId, startSequence }) {
      const queue = yield* RcMap.get(subscriptions, { publicKey: identity.publicKey, storeId })
      const authenticated = yield* sessionAuth.ensureAuthenticated(identity).pipe(
        Effect.mapError((cause) => makeRemoteError("changes", cause)),
        Effect.as(true),
        Effect.catch((error) =>
          Queue.fail(queue, error).pipe(
            Effect.as(false)
          )
        )
      )
      if (!authenticated) {
        identities.delete(identity.publicKey)
        return queue
      }
      identities.set(identity.publicKey, identity)
      yield* Effect.orDie(writeRequest(
        new RequestChanges({
          publicKey: identity.publicKey,
          storeId,
          startSequence
        })
      ))
      return queue
    })
  }
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromSocketUnencrypted = Effect.fnUntraced(function*(options?: {
  readonly disablePing?: boolean | undefined
}): Effect.fn.Return<EventLogRemote["Service"], never, Scope.Scope | Socket.Socket> {
  const socket = yield* Socket.Socket
  const writeRaw = yield* socket.writer

  const writeRequest = (request: typeof ProtocolRequestUnencrypted.Type) =>
    Effect.gen(function*() {
      const data = yield* encodeRequestUnencrypted(request)
      if (request._tag !== "WriteEntries" || data.byteLength <= constChunkSize) {
        return yield* writeRaw(data)
      }
      const id = request.id
      for (const part of ChunkedMessage.split(id, data)) {
        yield* writeRaw(yield* encodeRequestUnencrypted(part))
      }
    })

  const sessionAuth = makeSessionAuth({
    writeAuthenticate: writeRequest
  })

  let pendingCounter = 0
  const pending = new Map<number, {
    readonly entries: ReadonlyArray<Entry>
    readonly deferred: Deferred.Deferred<void, EventLogRemoteError>
    readonly publicKey: string
    readonly storeId: StoreId
  }>()
  const chunks = new Map<number, {
    readonly parts: Array<Uint8Array>
    count: number
    bytes: number
  }>()

  const subscriptions = yield* RcMap.make({
    lookup: (options: {
      readonly publicKey: string
      readonly storeId: StoreId
    }) =>
      Effect.acquireRelease(
        Queue.make<RemoteEntry, EventLogRemoteError>(),
        (queue) =>
          Queue.shutdown(queue).pipe(
            Effect.andThen(
              Effect.suspend(() =>
                sessionAuth.isAuthenticated(options.publicKey)
                  ? Effect.ignore(writeRequest(new StopChanges(options)))
                  : Effect.void
              )
            )
          )
      )
  })
  const identities = new Map<string, Identity["Service"]>()
  const badPing = yield* Deferred.make<never, Error>()
  const remoteId = yield* Deferred.make<RemoteId>()

  let latestPing = 0
  let latestPong = 0

  if (options?.disablePing !== true) {
    yield* Effect.suspend(() => {
      if (latestPing !== latestPong) {
        return Deferred.fail(badPing, new Error("Ping timeout"))
      }
      return writeRequest(new Ping({ id: ++latestPing }))
    }).pipe(
      Effect.delay("10 seconds"),
      Effect.ignoreCause,
      Effect.forever({ disableYield: true }),
      Effect.forkScoped
    )
  }

  const handleMessage = Effect.fnUntraced(
    function*(res: typeof ProtocolResponseUnencrypted.Type): Effect.fn.Return<void, Schema.SchemaError, Scope.Scope> {
      switch (res._tag) {
        case "Hello": {
          yield* sessionAuth.onHello(res)
          yield* Deferred.succeed(remoteId, res.remoteId)
          return
        }
        case "Authenticated": {
          yield* sessionAuth.onAuthenticated(res)
          return
        }
        case "Ack": {
          const entry = pending.get(res.id)
          if (!entry) return
          pending.delete(res.id)
          const { deferred, entries, publicKey, storeId } = entry
          const remoteEntries = res.sequenceNumbers.map((sequenceNumber, i) => {
            const entry = entries[i]
            return new RemoteEntry({
              remoteSequence: sequenceNumber,
              entry
            })
          })
          const queue = yield* RcMap.get(subscriptions, { publicKey, storeId })
          yield* Queue.offerAll(queue, remoteEntries)
          yield* Deferred.done(deferred, Exit.void)
          return
        }
        case "Pong": {
          latestPong = res.id
          if (res.id === latestPing) {
            return
          }
          yield* Deferred.fail(badPing, new Error("Pong id mismatch"))
          return
        }
        case "Changes": {
          const queue = yield* RcMap.get(subscriptions, { publicKey: res.publicKey, storeId: res.storeId })
          const identity = identities.get(res.publicKey)
          if (!identity) {
            return
          }
          yield* Queue.offerAll(queue, res.entries)
          return
        }
        case "ChunkedMessage": {
          const data = ChunkedMessage.join(chunks, res)
          if (!data) return
          const decoded = yield* decodeResponseUnencrypted(data)
          return yield* handleMessage(decoded)
        }
        case "Error": {
          if (res.requestTag === "Authenticate") {
            yield* sessionAuth.onAuthenticateError(res)
            return
          }
          if (res.requestTag === "WriteEntries" && res.id !== undefined) {
            const entry = pending.get(res.id)
            if (!entry) {
              return
            }
            pending.delete(res.id)
            yield* Deferred.fail(
              entry.deferred,
              makeRemoteError("write", res)
            )
            return
          }
          if (res.requestTag === "RequestChanges" && res.publicKey !== undefined && res.storeId !== undefined) {
            const publicKey = res.publicKey
            const key = { publicKey, storeId: res.storeId }
            const hasSubscription = yield* RcMap.has(subscriptions, key)
            if (!hasSubscription) {
              return
            }
            const queue = yield* RcMap.get(subscriptions, key)
            identities.delete(publicKey)
            yield* RcMap.invalidate(subscriptions, key)
            yield* Queue.fail(
              queue,
              makeRemoteError("changes", res)
            )
            return
          }
          return
        }
      }
    }
  )

  yield* socket.run((data) => Effect.flatMap(decodeResponseUnencrypted(data), handleMessage)).pipe(
    Effect.raceFirst(Deferred.await(badPing)),
    Effect.tapCause(Effect.logDebug),
    Effect.retry({
      schedule: Schedule.exponential(100).pipe(
        Schedule.either(Schedule.spaced(5000))
      )
    }),
    Effect.annotateLogs({
      service: "EventLogRemote",
      method: "fromSocketUnencrypted"
    }),
    Effect.forkScoped
  )

  const id = yield* Deferred.await(remoteId)

  return {
    id,
    write: Effect.fnUntraced(function*({ identity, storeId, entries }) {
      yield* sessionAuth.ensureAuthenticated(identity).pipe(
        Effect.mapError((cause) => makeRemoteError("authenticate", cause))
      )
      const deferred = yield* Deferred.make<void, EventLogRemoteError>()
      const id = pendingCounter++
      pending.set(id, {
        entries,
        deferred,
        publicKey: identity.publicKey,
        storeId
      })
      yield* Effect.orDie(writeRequest(
        new WriteEntriesUnencrypted({
          publicKey: identity.publicKey,
          storeId,
          id,
          entries
        })
      ))
      yield* Deferred.await(deferred)
    }),
    changes: Effect.fnUntraced(function*({ identity, storeId, startSequence }) {
      const queue = yield* RcMap.get(subscriptions, { publicKey: identity.publicKey, storeId })
      const authenticated = yield* sessionAuth.ensureAuthenticated(identity).pipe(
        Effect.mapError((cause) => makeRemoteError("changes", cause)),
        Effect.as(true),
        Effect.catch((error) =>
          Queue.fail(queue, error).pipe(
            Effect.as(false)
          )
        )
      )
      if (!authenticated) {
        identities.delete(identity.publicKey)
        return queue
      }
      identities.set(identity.publicKey, identity)
      yield* Effect.orDie(writeRequest(
        new RequestChanges({
          storeId,
          publicKey: identity.publicKey,
          startSequence
        })
      ))
      return queue
    })
  }
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromWebSocket = <const Unencrypted extends boolean = false>(
  url: string,
  options?: {
    readonly disablePing?: boolean | undefined
    readonly unencrypted?: Unencrypted | undefined
  }
): Effect.Effect<
  EventLogRemote["Service"],
  never,
  Scope.Scope | (Unencrypted extends true ? never : EventLogEncryption) | Socket.WebSocketConstructor
> =>
  Effect.gen(function*() {
    const socket = yield* Socket.makeWebSocket(url)
    return yield* (options?.unencrypted ? fromSocketUnencrypted(options) : fromSocket(options)).pipe(
      Effect.provideService(Socket.Socket, socket)
    )
  }) as any

/**
 * @since 4.0.0
 * @category layers
 */
export const layerWebSocket = <const Unencrypted extends boolean = false>(
  url: string,
  options?: {
    readonly disablePing?: boolean | undefined
    readonly unencrypted?: Unencrypted | undefined
  }
): Layer.Layer<
  EventLogRemote,
  never,
  Socket.WebSocketConstructor | (Unencrypted extends true ? never : EventLogEncryption)
> => Layer.effect(EventLogRemote, fromWebSocket(url, options))

/**
 * @since 4.0.0
 * @category layers
 */
export const layerWebSocketBrowser = (
  url: string,
  options?: {
    readonly disablePing?: boolean | undefined
    readonly unencrypted?: boolean | undefined
  }
): Layer.Layer<EventLogRemote> =>
  layerWebSocket(url, options).pipe(
    Layer.provide([layerSubtle, Socket.layerWebSocketConstructorGlobal])
  )
