/**
 * @since 4.0.0
 */
import * as Uuid from "uuid"
import type * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import * as FiberMap from "../../FiberMap.ts"
import * as Layer from "../../Layer.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as HttpServerError from "../http/HttpServerError.ts"
import * as HttpServerRequest from "../http/HttpServerRequest.ts"
import * as HttpServerResponse from "../http/HttpServerResponse.ts"
import type * as Socket from "../socket/Socket.ts"
import { EntryId, makeRemoteIdUnsafe, type RemoteId } from "./EventJournal.ts"
import type * as EventLog from "./EventLog.ts"
import { makeEncryptedScopeKey } from "./EventLogEncryptedScope.ts"
import type { EncryptedRemoteEntry } from "./EventLogEncryption.ts"
import {
  Ack,
  Authenticated,
  Changes,
  ChunkedMessage,
  decodeRequest,
  encodeResponse,
  Hello,
  Pong,
  ProtocolError,
  type ProtocolRequest,
  type ProtocolResponse
} from "./EventLogRemote.ts"
import * as EventLogSessionAuth from "./EventLogSessionAuth.ts"

const constChunkSize = 512_000

const copyUint8Array = (bytes: Uint8Array): Uint8Array => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

const equalsUint8Array = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) {
    return false
  }

  for (let index = 0; index < left.byteLength; index++) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeHandler: Effect.Effect<
  (socket: Socket.Socket) => Effect.Effect<void, Socket.SocketError>,
  never,
  Storage
> = Effect.gen(function*() {
  const storage = yield* Storage
  const remoteId = yield* storage.getId
  const trustedSessionAuthBindings = new Map<string, Uint8Array>()
  const persistedSessionAuthBindings = yield* storage.loadSessionAuthBindings
  for (const [publicKey, signingPublicKey] of persistedSessionAuthBindings) {
    trustedSessionAuthBindings.set(publicKey, copyUint8Array(signingPublicKey))
  }
  let chunkId = 0

  const ensureTrustedSessionAuthBinding = Effect.fnUntraced(function*(options: {
    readonly publicKey: string
    readonly signingPublicKey: Uint8Array
  }) {
    const trustedSigningPublicKey = trustedSessionAuthBindings.get(options.publicKey)
    if (trustedSigningPublicKey !== undefined) {
      return equalsUint8Array(trustedSigningPublicKey, options.signingPublicKey)
    }

    const created = yield* storage.putSessionAuthBindingIfAbsent(options.publicKey, options.signingPublicKey)
    if (created) {
      trustedSessionAuthBindings.set(options.publicKey, copyUint8Array(options.signingPublicKey))
      return true
    }

    const persistedSigningPublicKey = yield* storage.getSessionAuthBinding(options.publicKey)
    if (persistedSigningPublicKey === undefined) {
      return false
    }

    trustedSessionAuthBindings.set(options.publicKey, copyUint8Array(persistedSigningPublicKey))
    return equalsUint8Array(persistedSigningPublicKey, options.signingPublicKey)
  })

  return Effect.fnUntraced(
    function*(socket: Socket.Socket) {
      const subscriptions = yield* FiberMap.make<string>()
      const writeRaw = yield* socket.writer
      const chunks = new Map<
        number,
        {
          readonly parts: Array<Uint8Array>
          count: number
          bytes: number
        }
      >()
      let latestSequence = -1
      const sessionChallenge = yield* EventLogSessionAuth.makeSessionAuthChallenge.pipe(Effect.orDie)
      const sessionChallengeIssuedAt = Date.now()
      let sessionChallengeUsed = false
      let authenticatedPublicKey: string | undefined

      const write = Effect.fnUntraced(function*(response: Schema.Schema.Type<typeof ProtocolResponse>) {
        const data = yield* encodeResponse(response)
        if (response._tag !== "Changes" || data.byteLength <= constChunkSize) {
          return yield* writeRaw(data)
        }
        const id = chunkId++
        for (const part of ChunkedMessage.split(id, data)) {
          yield* writeRaw(yield* encodeResponse(part))
        }
      })

      const writeForbidden = Effect.fnUntraced(function*(options: {
        readonly requestTag: "Authenticate" | "WriteEntries" | "RequestChanges" | "StopChanges"
        readonly id?: number | undefined
        readonly publicKey?: string | undefined
      }) {
        yield* Effect.orDie(write(
          new ProtocolError({
            requestTag: options.requestTag,
            id: options.id,
            publicKey: options.publicKey,
            code: "Forbidden",
            message: "Forbidden request"
          })
        ))
      })

      const handleAuthenticate = Effect.fnUntraced(
        function*(request: Extract<Schema.Schema.Type<typeof ProtocolRequest>, { readonly _tag: "Authenticate" }>) {
          if (authenticatedPublicKey !== undefined) {
            if (authenticatedPublicKey === request.publicKey) {
              return yield* Effect.orDie(write(new Authenticated({ publicKey: request.publicKey })))
            }

            return yield* writeForbidden({
              requestTag: "Authenticate",
              publicKey: request.publicKey
            })
          }

          const challengeAlreadyUsed = sessionChallengeUsed
          sessionChallengeUsed = true

          const verified = yield* EventLogSessionAuth.verifySessionAuthenticateRequest({
            remoteId,
            challenge: sessionChallenge,
            challengeIssuedAtMillis: sessionChallengeIssuedAt,
            challengeAlreadyUsed,
            publicKey: request.publicKey,
            signingPublicKey: request.signingPublicKey,
            signature: request.signature,
            algorithm: request.algorithm
          }).pipe(
            Effect.as(true),
            Effect.catchTag("EventLogSessionAuthError", () => Effect.succeed(false))
          )

          if (!verified) {
            return yield* writeForbidden({
              requestTag: "Authenticate",
              publicKey: request.publicKey
            })
          }

          const trusted = yield* ensureTrustedSessionAuthBinding({
            publicKey: request.publicKey,
            signingPublicKey: request.signingPublicKey
          })
          if (!trusted) {
            return yield* writeForbidden({
              requestTag: "Authenticate",
              publicKey: request.publicKey
            })
          }

          authenticatedPublicKey = request.publicKey
          return yield* Effect.orDie(write(new Authenticated({ publicKey: request.publicKey })))
        }
      )

      yield* Effect.forkChild(Effect.orDie(write(
        new Hello({
          remoteId,
          challenge: sessionChallenge
        })
      )))

      const handleRequest = (request: Schema.Schema.Type<typeof ProtocolRequest>): Effect.Effect<void> => {
        switch (request._tag) {
          case "Ping": {
            return Effect.orDie(write(new Pong({ id: request.id })))
          }
          case "Authenticate": {
            return handleAuthenticate(request)
          }
          case "WriteEntries": {
            if (authenticatedPublicKey !== request.publicKey) {
              return writeForbidden({
                requestTag: "WriteEntries",
                id: request.id,
                publicKey: request.publicKey
              })
            }

            if (request.encryptedEntries.length === 0) {
              return Effect.orDie(
                write(
                  new Ack({
                    id: request.id,
                    sequenceNumbers: []
                  })
                )
              )
            }
            return Effect.gen(function*() {
              const entries = request.encryptedEntries.map(({ encryptedEntry, entryId }) =>
                new PersistedEntry({
                  entryId,
                  iv: request.iv,
                  encryptedEntry
                })
              )
              const encrypted = yield* storage.write(request.publicKey, request.storeId, entries)
              latestSequence = encrypted[encrypted.length - 1].sequence
              return yield* Effect.orDie(
                write(
                  new Ack({
                    id: request.id,
                    sequenceNumbers: encrypted.map((entry) => entry.sequence)
                  })
                )
              )
            })
          }
          case "RequestChanges": {
            if (authenticatedPublicKey !== request.publicKey) {
              return writeForbidden({
                requestTag: "RequestChanges",
                publicKey: request.publicKey
              })
            }

            return Effect.gen(function*() {
              const changes = yield* storage.changes(request.publicKey, request.storeId, request.startSequence)
              return yield* Queue.takeAll(changes).pipe(
                Effect.flatMap((entries) => {
                  const latestEntries: Array<EncryptedRemoteEntry> = []
                  for (const entry of entries) {
                    if (entry.sequence <= latestSequence) continue
                    latestEntries.push(entry)
                    latestSequence = entry.sequence
                  }
                  if (latestEntries.length === 0) return Effect.void
                  return Effect.orDie(
                    write(
                      new Changes({
                        publicKey: request.publicKey,
                        storeId: request.storeId,
                        entries: latestEntries
                      })
                    )
                  )
                }),
                Effect.forever
              )
            }).pipe(
              Effect.scoped,
              FiberMap.run(subscriptions, request.publicKey)
            )
          }
          case "StopChanges": {
            if (authenticatedPublicKey !== request.publicKey) {
              return writeForbidden({
                requestTag: "StopChanges",
                publicKey: request.publicKey
              })
            }

            return FiberMap.remove(subscriptions, request.publicKey)
          }
          case "ChunkedMessage": {
            const data = ChunkedMessage.join(chunks, request)
            if (!data) return Effect.void
            return Effect.flatMap(Effect.orDie(decodeRequest(data)), handleRequest)
          }
        }
      }

      yield* socket.run((data) => Effect.flatMap(Effect.orDie(decodeRequest(data)), handleRequest)).pipe(
        Effect.catchCause((cause) => Effect.logDebug(cause))
      )
    },
    Effect.scoped,
    Effect.annotateLogs({
      module: "EventLogServer"
    })
  )
})

/**
 * @since 4.0.0
 * @category websockets
 */
export const makeHandlerHttp: Effect.Effect<
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    HttpServerError.HttpServerError | Socket.SocketError,
    HttpServerRequest.HttpServerRequest | Scope.Scope
  >,
  never,
  Storage
> = Effect.gen(function*() {
  const handler = yield* makeHandler

  // @effect-diagnostics-next-line returnEffectInGen:off
  return Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const socket = yield* request.upgrade
    yield* handler(socket)
    return HttpServerResponse.empty()
  }).pipe(Effect.annotateLogs({
    module: "EventLogServer"
  }))
})

/**
 * @since 4.0.0
 * @category storage
 */
export class PersistedEntry extends Schema.Class<PersistedEntry>(
  "effect/eventlog/EventLogServer/PersistedEntry"
)({
  entryId: EntryId,
  iv: Schema.Uint8Array,
  encryptedEntry: Schema.Uint8Array
}) {
  /**
   * @since 4.0.0
   */
  get entryIdString(): string {
    return Uuid.stringify(this.entryId)
  }
}

/**
 * @since 4.0.0
 * @category storage
 */
export class Storage extends ServiceMap.Service<Storage, {
  readonly getId: Effect.Effect<RemoteId>
  readonly loadSessionAuthBindings: Effect.Effect<ReadonlyMap<string, Uint8Array>>
  readonly getSessionAuthBinding: (publicKey: string) => Effect.Effect<Uint8Array | undefined>
  readonly putSessionAuthBindingIfAbsent: (publicKey: string, signingPublicKey: Uint8Array) => Effect.Effect<boolean>
  readonly write: (
    publicKey: string,
    storeId: EventLog.StoreId,
    entries: ReadonlyArray<PersistedEntry>
  ) => Effect.Effect<ReadonlyArray<EncryptedRemoteEntry>>
  readonly entries: (
    publicKey: string,
    storeId: EventLog.StoreId,
    startSequence: number
  ) => Effect.Effect<ReadonlyArray<EncryptedRemoteEntry>>
  readonly changes: (
    publicKey: string,
    storeId: EventLog.StoreId,
    startSequence: number
  ) => Effect.Effect<Queue.Dequeue<EncryptedRemoteEntry, Cause.Done>, never, Scope.Scope>
}>()("effect/eventlog/EventLogServer/Storage") {}

/**
 * @since 4.0.0
 * @category storage
 */
export const makeStorageMemory: Effect.Effect<Storage["Service"], never, Scope.Scope> = Effect.gen(function*() {
  const knownIds = new Map<string, Map<string, number>>()
  const journals = new Map<string, Array<EncryptedRemoteEntry>>()
  const sessionAuthBindings = new Map<string, Uint8Array>()
  const remoteId = makeRemoteIdUnsafe()
  const ensureKnownIds = (scopeKey: string): Map<string, number> => {
    let storeKnownIds = knownIds.get(scopeKey)
    if (storeKnownIds) return storeKnownIds
    storeKnownIds = new Map<string, number>()
    knownIds.set(scopeKey, storeKnownIds)
    return storeKnownIds
  }
  const ensureJournal = (scopeKey: string) => {
    let journal = journals.get(scopeKey)
    if (journal) return journal
    journal = []
    journals.set(scopeKey, journal)
    return journal
  }
  const pubsubs = yield* RcMap.make({
    lookup: (_scopeKey: string) =>
      Effect.acquireRelease(
        PubSub.unbounded<EncryptedRemoteEntry>(),
        PubSub.shutdown
      ),
    idleTimeToLive: 60000
  })

  return Storage.of({
    getId: Effect.succeed(remoteId),
    loadSessionAuthBindings: Effect.sync(() =>
      new Map(
        Array.from(sessionAuthBindings, ([publicKey, signingPublicKey]) =>
          [publicKey, copyUint8Array(signingPublicKey)] as const)
      )
    ),
    getSessionAuthBinding: (publicKey) =>
      Effect.sync(() => {
        const signingPublicKey = sessionAuthBindings.get(publicKey)
        return signingPublicKey === undefined ? undefined : copyUint8Array(signingPublicKey)
      }),
    putSessionAuthBindingIfAbsent: (publicKey, signingPublicKey) =>
      Effect.sync(() => {
        if (sessionAuthBindings.has(publicKey)) {
          return false
        }
        sessionAuthBindings.set(publicKey, copyUint8Array(signingPublicKey))
        return true
      }),
    write: (publicKey, storeId, entries) =>
      Effect.gen(function*() {
        const scopeKey = makeEncryptedScopeKey({ publicKey, storeId })
        const active = yield* RcMap.keys(pubsubs)
        let pubsub: PubSub.PubSub<EncryptedRemoteEntry> | undefined
        for (const key of active) {
          if (key === scopeKey) {
            pubsub = yield* RcMap.get(pubsubs, scopeKey)
            break
          }
        }
        const storeKnownIds = ensureKnownIds(scopeKey)
        const journal = ensureJournal(scopeKey)
        const encryptedEntries: Array<EncryptedRemoteEntry> = []
        for (const entry of entries) {
          const idString = entry.entryIdString
          if (storeKnownIds.has(idString)) continue
          const encrypted: EncryptedRemoteEntry = {
            sequence: journal.length,
            entryId: entry.entryId,
            iv: entry.iv,
            encryptedEntry: entry.encryptedEntry
          }
          encryptedEntries.push(encrypted)
          storeKnownIds.set(idString, encrypted.sequence)
          journal.push(encrypted)
          if (pubsub) {
            yield* PubSub.publish(pubsub, encrypted)
          }
        }
        return encryptedEntries
      }).pipe(Effect.scoped),
    entries: (publicKey, storeId, startSequence) =>
      Effect.sync(() => ensureJournal(makeEncryptedScopeKey({ publicKey, storeId })).slice(startSequence)),
    changes: (publicKey, storeId, startSequence) =>
      Effect.gen(function*() {
        const scopeKey = makeEncryptedScopeKey({ publicKey, storeId })
        const queue = yield* Queue.make<EncryptedRemoteEntry>()
        const pubsub = yield* RcMap.get(pubsubs, scopeKey)
        const subscription = yield* PubSub.subscribe(pubsub)
        yield* Queue.offerAll(queue, ensureJournal(scopeKey).slice(startSequence))
        yield* PubSub.takeAll(subscription).pipe(
          Effect.flatMap((chunk) => Queue.offerAll(queue, chunk)),
          Effect.forever,
          Effect.forkScoped
        )
        yield* Effect.addFinalizer(() => Queue.shutdown(queue))
        return Queue.asDequeue(queue)
      })
  })
})

/**
 * @since 4.0.0
 * @category storage
 */
export const layerStorageMemory: Layer.Layer<Storage> = Layer.effect(Storage)(makeStorageMemory)
