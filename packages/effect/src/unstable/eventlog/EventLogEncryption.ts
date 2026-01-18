/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schema from "../../Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import { Entry, EntryId, RemoteEntry } from "./EventJournal.ts"

/**
 * @since 4.0.0
 * @category models
 */
export const EncryptedEntry = Schema.Struct({
  entryId: EntryId,
  encryptedEntry: Schema.Uint8Array
})

/**
 * @since 4.0.0
 * @category models
 */
export interface EncryptedRemoteEntry extends Schema.Schema.Type<typeof EncryptedRemoteEntry> {}

/**
 * @since 4.0.0
 * @category models
 */
export const EncryptedRemoteEntry = Schema.Struct({
  sequence: Schema.Number,
  iv: Schema.Uint8Array,
  entryId: EntryId,
  encryptedEntry: Schema.Uint8Array
})

const toArrayBuffer = (data: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)
  return buffer
}

const toBufferSource = (data: Uint8Array): ArrayBufferView<ArrayBuffer> => new Uint8Array(toArrayBuffer(data))

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId = "~effect/eventlog/EventLogEncryption"

/**
 * @since 4.0.0
 * @category type ids
 */
export type EventLogEncryptionTypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category services
 */
export interface EventLogEncryption {
  readonly [TypeId]: EventLogEncryptionTypeId
  readonly encrypt: (
    identity: EventLogEncryptionIdentity,
    entries: ReadonlyArray<Entry>
  ) => Effect.Effect<{
    readonly iv: Uint8Array
    readonly encryptedEntries: ReadonlyArray<Uint8Array>
  }>
  readonly decrypt: (
    identity: EventLogEncryptionIdentity,
    entries: ReadonlyArray<EncryptedRemoteEntry>
  ) => Effect.Effect<Array<RemoteEntry>>
  readonly sha256String: (data: Uint8Array) => Effect.Effect<string>
  readonly sha256: (data: Uint8Array) => Effect.Effect<Uint8Array>
}

/**
 * @since 4.0.0
 * @category services
 */
export interface EventLogEncryptionIdentity {
  readonly privateKey: Redacted.Redacted<Uint8Array>
}

/**
 * @since 4.0.0
 * @category services
 */
export const EventLogEncryption: ServiceMap.Service<EventLogEncryption, EventLogEncryption> = ServiceMap.Service(
  TypeId
)

/**
 * @since 4.0.0
 * @category encryption
 */
export const makeEncryptionSubtle = (crypto: Crypto): Effect.Effect<EventLogEncryption> =>
  Effect.sync(() => {
    const keyCache = new WeakMap<EventLogEncryptionIdentity, CryptoKey>()
    const getKey = (identity: EventLogEncryptionIdentity) =>
      Effect.suspend(() => {
        if (keyCache.has(identity)) {
          return Effect.succeed(keyCache.get(identity)!)
        }
        return Effect.promise(() =>
          crypto.subtle.importKey(
            "raw",
            toArrayBuffer(Redacted.value(identity.privateKey)),
            "AES-GCM",
            true,
            ["encrypt", "decrypt"]
          )
        ).pipe(
          Effect.tap((key) => {
            keyCache.set(identity, key)
          })
        )
      })

    return EventLogEncryption.of({
      [TypeId]: TypeId,
      encrypt: (identity, entries) =>
        Effect.gen(function*() {
          const data = yield* Effect.orDie(Entry.encodeArray(entries))
          const key = yield* getKey(identity)
          const iv = crypto.getRandomValues(new Uint8Array(12))
          const encryptedEntries = yield* Effect.promise(() =>
            Promise.all(
              data.map((entry) =>
                crypto.subtle.encrypt(
                  { name: "AES-GCM", iv: toBufferSource(iv), tagLength: 128 },
                  key,
                  toBufferSource(entry)
                )
              )
            )
          )
          return {
            iv,
            encryptedEntries: encryptedEntries.map((entry) => new Uint8Array(entry))
          }
        }),
      decrypt: (identity, entries) =>
        Effect.gen(function*() {
          const key = yield* getKey(identity)
          const decryptedData = (yield* Effect.promise(() =>
            Promise.all(entries.map((data) =>
              crypto.subtle.decrypt(
                { name: "AES-GCM", iv: toBufferSource(data.iv), tagLength: 128 },
                key,
                toBufferSource(data.encryptedEntry)
              )
            ))
          )).map((buffer) => new Uint8Array(buffer))
          const decoded = yield* Effect.orDie(Entry.decodeArray(decryptedData))
          return decoded.map((entry, index) => new RemoteEntry({ remoteSequence: entries[index].sequence, entry }))
        }),
      sha256: (data) =>
        Effect.promise(() => crypto.subtle.digest("SHA-256", toArrayBuffer(data))).pipe(
          Effect.map((hash) => new Uint8Array(hash))
        ),
      sha256String: (data) =>
        Effect.map(
          Effect.promise(() => crypto.subtle.digest("SHA-256", toArrayBuffer(data))),
          (hash) => {
            const hashArray = Array.from(new Uint8Array(hash))
            const hashHex = hashArray
              .map((bytes) => bytes.toString(16).padStart(2, "0"))
              .join("")
            return hashHex
          }
        )
    })
  })

/**
 * @since 4.0.0
 * @category encryption
 */
export const layerSubtle: Layer.Layer<EventLogEncryption> = Layer.effect(
  EventLogEncryption,
  makeEncryptionSubtle(globalThis.crypto)
)
