/**
 * @since 4.0.0
 */
import * as Cache from "../../Cache.ts"
import * as Data from "../../Data.ts"
import * as Effect from "../../Effect.ts"
import { Layer } from "../../index.ts"
import * as Queue from "../../Queue.ts"
import * as Redacted from "../../Redacted.ts"
import type * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as RpcClient from "../rpc/RpcClient.ts"
import type * as RpcGroup from "../rpc/RpcGroup.ts"
import type { Entry, RemoteEntry, RemoteId } from "./EventJournal.ts"
import type { Identity } from "./EventLog.ts"
import { EventLogEncryption, layerSubtle } from "./EventLogEncryption.ts"
import {
  Authenticate,
  ChangesRpc,
  ChunkedMessage,
  EventLogRemoteRpcs,
  type HelloResponse,
  type StoreId,
  WriteEntries,
  WriteEntriesUnencrypted
} from "./EventLogMessage.ts"
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
 * @category errors
 */
export class EventLogRemoteError extends Data.TaggedError("EventLogRemoteError")<{
  readonly method: string
  readonly cause: unknown
}> {}

const makeAuthenticate = Effect.fnUntraced(function*(options: {
  readonly identity: Identity["Service"]
  readonly hello: HelloResponse
}) {
  const payload = yield* encodeSessionAuthPayload({
    remoteId: options.hello.remoteId,
    challenge: options.hello.challenge,
    publicKey: options.identity.publicKey,
    signingPublicKey: options.identity.signingPublicKey
  })
  const signature = yield* signSessionAuthPayloadBytes({
    payload,
    signingPrivateKey: Redacted.value(options.identity.signingPrivateKey)
  })

  return new Authenticate({
    publicKey: options.identity.publicKey,
    signingPublicKey: options.identity.signingPublicKey,
    signature,
    algorithm: "Ed25519"
  })
})

/**
 * @since 4.0.0
 * @category RpcClient
 */
export class EventLogRemoteClient
  extends ServiceMap.Service<EventLogRemoteClient, RpcClient.RpcClient<RpcGroup.Rpcs<typeof EventLogRemoteRpcs>>>()(
    "effect/unstable/eventlog/EventLogRemote/EventLogRemoteClient"
  )
{
  static readonly layer = Layer.effect(
    EventLogRemoteClient,
    RpcClient.make(EventLogRemoteRpcs, {
      disableTracing: true
    })
  )
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeWith = Effect.fnUntraced(function*({ encodeWrite, decodeChanges }: {
  readonly encodeWrite: (options: {
    readonly identity: Identity["Service"]
    readonly entries: ReadonlyArray<Entry>
    readonly storeId: StoreId
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, Schema.SchemaError>
  readonly decodeChanges: (
    identity: Identity["Service"],
    data: Uint8Array<ArrayBuffer>
  ) => Effect.Effect<ReadonlyArray<RemoteEntry>, Schema.SchemaError>
}): Effect.fn.Return<EventLogRemote["Service"], EventLogRemoteError, Scope.Scope | EventLogRemoteClient> {
  const client = yield* EventLogRemoteClient

  const hello = yield* client["EventLog.Hello"]().pipe(
    Effect.mapError((cause) => new EventLogRemoteError({ method: "hello", cause }))
  )

  const identities = new Map<string, Identity["Service"]>()
  const authCache = yield* Cache.make({
    lookup: Effect.fnUntraced(function*(publicKey: string) {
      const identity = identities.get(publicKey)!
      const authenticate = yield* makeAuthenticate({
        identity,
        hello
      })
      yield* client["EventLog.Authenticate"](authenticate)
    }, Effect.mapError((cause) => new EventLogRemoteError({ method: "authenticate", cause }))),
    capacity: Number.MAX_SAFE_INTEGER
  })

  const ensureAuthenticated = (identity: Identity["Service"]) => {
    if (!identities.has(identity.publicKey)) {
      identities.set(identity.publicKey, identity)
    }
    return Cache.get(authCache, identity.publicKey)
  }

  let chunkedIdCounter = 0

  return EventLogRemote.of({
    id: hello.remoteId,
    write: Effect.fnUntraced(function*(options) {
      yield* ensureAuthenticated(options.identity)
      const encoded = yield* encodeWrite(options)
      if (encoded.byteLength <= ChunkedMessage.chunkSize) {
        return yield* client["EventLog.WriteSingle"]({ data: encoded })
      }
      for (const part of ChunkedMessage.split(chunkedIdCounter++, encoded)) {
        yield* client["EventLog.WriteChunked"](part)
      }
    }, Effect.mapError((cause) => new EventLogRemoteError({ method: "write", cause }))),
    changes: Effect.fnUntraced(function*(options) {
      const outgoing = yield* Queue.make<RemoteEntry, EventLogRemoteError>()

      yield* Effect.gen(function*() {
        yield* ensureAuthenticated(options.identity)

        const chunkedState = ChunkedMessage.initialJoinState()
        const incoming = yield* client["EventLog.Changes"]({
          publicKey: options.identity.publicKey,
          storeId: options.storeId,
          startSequence: options.startSequence
        }, { asQueue: true })

        while (true) {
          const parts = yield* Queue.takeAll(incoming)
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            if (part._tag === "Single") {
              yield* Queue.offerAll(outgoing, yield* decodeChanges(options.identity, part.data))
              continue
            }
            const data = ChunkedMessage.join(chunkedState, part)
            if (!data) continue
            yield* Queue.offerAll(outgoing, yield* decodeChanges(options.identity, data))
          }
        }
      }).pipe(
        Effect.mapError((cause) => {
          if (cause._tag === "EventLogRemoteError") {
            return cause
          }
          return new EventLogRemoteError({
            method: "changes",
            cause
          })
        }),
        Effect.catchCause((cause) => Queue.failCause(outgoing, cause)),
        Effect.forkScoped
      )

      return outgoing
    })
  })
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeEncrypted = Effect.gen(function*(): Effect.fn.Return<
  EventLogRemote["Service"],
  EventLogRemoteError,
  Scope.Scope | EventLogRemoteClient | EventLogEncryption
> {
  const encryption = yield* EventLogEncryption

  return yield* makeWith({
    encodeWrite: (options) =>
      encryption.encrypt(options.identity, options.entries).pipe(
        Effect.flatMap((msg) =>
          new WriteEntries({
            publicKey: options.identity.publicKey,
            storeId: options.storeId,
            iv: msg.iv,
            encryptedEntries: msg.encryptedEntries.map((entry, i) => ({
              entryId: options.entries[i].id,
              encryptedEntry: entry
            }))
          }).encoded
        )
      ),
    decodeChanges: (identity, data) =>
      ChangesRpc.decodeEncrypted(data).pipe(
        Effect.flatMap((entries) => encryption.decrypt(identity, entries))
      )
  })
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeUnencrypted: Effect.Effect<
  EventLogRemote["Service"],
  EventLogRemoteError,
  Scope.Scope | EventLogRemoteClient
> = makeWith({
  encodeWrite: (options) =>
    new WriteEntriesUnencrypted({
      publicKey: options.identity.publicKey,
      storeId: options.storeId,
      entries: options.entries
    }).encoded,
  decodeChanges: (_identity, data) => ChangesRpc.decodeUnencrypted(data)
})

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerEncrypted: Layer.Layer<
  EventLogRemote,
  EventLogRemoteError,
  RpcClient.Protocol
> = Layer.effect(EventLogRemote, makeEncrypted).pipe(
  Layer.provide(EventLogRemoteClient.layer),
  Layer.provide(layerSubtle)
)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerUnencrypted: Layer.Layer<
  EventLogRemote,
  EventLogRemoteError,
  RpcClient.Protocol
> = Layer.effect(EventLogRemote, makeUnencrypted).pipe(
  Layer.provide(EventLogRemoteClient.layer)
)
