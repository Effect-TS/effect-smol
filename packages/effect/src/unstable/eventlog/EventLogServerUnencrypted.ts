/**
 * @since 4.0.0
 */
import type { Brand } from "../../Brand.ts"
import type * as Cause from "../../Cause.ts"
import * as Data from "../../Data.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import { type Entry, makeRemoteIdUnsafe, RemoteEntry, type RemoteId } from "./EventJournal.ts"

/**
 * @since 4.0.0
 * @category store
 */
export type StoreIdTypeId = "effect/eventlog/EventLogServerUnencrypted/StoreId"

/**
 * @since 4.0.0
 * @category store
 */
export const StoreIdTypeId: StoreIdTypeId = "effect/eventlog/EventLogServerUnencrypted/StoreId"

/**
 * @since 4.0.0
 * @category store
 */
export type StoreId = string & Brand<StoreIdTypeId>

/**
 * @since 4.0.0
 * @category store
 */
export const StoreId = Schema.String.pipe(Schema.brand(StoreIdTypeId))

/**
 * @since 4.0.0
 * @category errors
 */
export class EventLogServerStoreError extends Data.TaggedError("EventLogServerStoreError")<{
  readonly reason: "NotFound" | "PersistenceFailure"
  readonly publicKey?: string | undefined
  readonly storeId?: StoreId | undefined
  readonly message?: string | undefined
}> {}

/**
 * @since 4.0.0
 * @category errors
 */
export class EventLogServerAuthError extends Data.TaggedError("EventLogServerAuthError")<{
  readonly reason: "Unauthorized" | "Forbidden"
  readonly publicKey: string
  readonly storeId?: StoreId | undefined
  readonly message?: string | undefined
}> {}

/**
 * @since 4.0.0
 * @category context
 */
export class EventLogServerAuth extends ServiceMap.Service<EventLogServerAuth, {
  readonly authorizeWrite: (options: {
    readonly publicKey: string
    readonly storeId: StoreId
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<void, EventLogServerAuthError>
  readonly authorizeRead: (options: {
    readonly publicKey: string
    readonly storeId: StoreId
  }) => Effect.Effect<void, EventLogServerAuthError>
}>()("effect/eventlog/EventLogServerUnencrypted/EventLogServerAuth") {}

/**
 * @since 4.0.0
 * @category storage
 */
export class Storage extends ServiceMap.Service<Storage, {
  readonly getId: Effect.Effect<RemoteId>
  readonly write: (
    storeId: StoreId,
    entries: ReadonlyArray<Entry>
  ) => Effect.Effect<{
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }>
  readonly entries: (
    storeId: StoreId,
    startSequence: number
  ) => Effect.Effect<ReadonlyArray<RemoteEntry>>
  readonly changes: (
    storeId: StoreId,
    startSequence: number
  ) => Effect.Effect<Queue.Dequeue<RemoteEntry, Cause.Done>, never, Scope.Scope>
}>()("effect/eventlog/EventLogServerUnencrypted/Storage") {}

const toStoreKey = (storeId: StoreId): string => storeId as string

const entriesAfter = (journal: Array<RemoteEntry>, startSequence: number): ReadonlyArray<RemoteEntry> =>
  journal.filter((entry) => entry.remoteSequence > startSequence)

/**
 * @since 4.0.0
 * @category storage
 */
export const makeStorageMemory: Effect.Effect<Storage["Service"], never, Scope.Scope> = Effect.gen(function*() {
  const knownIds = new Map<string, Map<string, number>>()
  const journals = new Map<string, Array<RemoteEntry>>()
  const remoteId = makeRemoteIdUnsafe()

  const ensureKnownIds = (storeId: StoreId): Map<string, number> => {
    const key = toStoreKey(storeId)
    let storeKnownIds = knownIds.get(key)
    if (storeKnownIds) return storeKnownIds
    storeKnownIds = new Map()
    knownIds.set(key, storeKnownIds)
    return storeKnownIds
  }

  const ensureJournal = (storeId: StoreId): Array<RemoteEntry> => {
    const key = toStoreKey(storeId)
    let journal = journals.get(key)
    if (journal) return journal
    journal = []
    journals.set(key, journal)
    return journal
  }

  const pubsubs = yield* RcMap.make({
    lookup: (_storeId: string) =>
      Effect.acquireRelease(
        PubSub.unbounded<RemoteEntry>(),
        PubSub.shutdown
      ),
    idleTimeToLive: 60000
  })

  return Storage.of({
    getId: Effect.succeed(remoteId),
    write: (storeId, entries) =>
      Effect.gen(function*() {
        const storeKey = toStoreKey(storeId)
        const active = yield* RcMap.keys(pubsubs)
        let pubsub: PubSub.PubSub<RemoteEntry> | undefined
        for (const key of active) {
          if (key === storeKey) {
            pubsub = yield* RcMap.get(pubsubs, storeKey)
            break
          }
        }

        const knownIds = ensureKnownIds(storeId)
        const journal = ensureJournal(storeId)
        const sequenceNumbers: Array<number> = []
        const committed: Array<RemoteEntry> = []

        for (const entry of entries) {
          const existing = knownIds.get(entry.idString)
          if (existing !== undefined) {
            sequenceNumbers.push(existing)
            continue
          }

          const remoteEntry = new RemoteEntry({
            remoteSequence: journal.length + 1,
            entry
          }, { disableChecks: true })

          knownIds.set(entry.idString, remoteEntry.remoteSequence)
          journal.push(remoteEntry)
          sequenceNumbers.push(remoteEntry.remoteSequence)
          committed.push(remoteEntry)

          if (pubsub) {
            yield* PubSub.publish(pubsub, remoteEntry)
          }
        }

        return {
          sequenceNumbers,
          committed
        }
      }).pipe(Effect.scoped),
    entries: (storeId, startSequence) => Effect.sync(() => entriesAfter(ensureJournal(storeId), startSequence)),
    changes: (storeId, startSequence) =>
      Effect.gen(function*() {
        const storeKey = toStoreKey(storeId)
        const queue = yield* Queue.make<RemoteEntry>()
        const pubsub = yield* RcMap.get(pubsubs, storeKey)
        const subscription = yield* PubSub.subscribe(pubsub)

        yield* Queue.offerAll(queue, entriesAfter(ensureJournal(storeId), startSequence))
        yield* PubSub.takeAll(subscription).pipe(
          Effect.flatMap((chunk) =>
            Queue.offerAll(queue, chunk.filter((entry) => entry.remoteSequence > startSequence))
          ),
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
