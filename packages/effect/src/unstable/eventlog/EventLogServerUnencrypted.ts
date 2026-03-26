/**
 * @since 4.0.0
 */
import * as Uuid from "uuid"
import type { Brand } from "../../Brand.ts"
import type * as Cause from "../../Cause.ts"
import * as Data from "../../Data.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as Semaphore from "../../Semaphore.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Persistence from "../persistence/Persistence.ts"
import { Reactivity } from "../reactivity/Reactivity.ts"
import * as ReactivityLayer from "../reactivity/Reactivity.ts"
import type * as Event from "./Event.ts"
import type * as EventGroup from "./EventGroup.ts"
import * as EventJournal from "./EventJournal.ts"
import {
  type Entry,
  type EntryId,
  makeEntryIdUnsafe,
  makeRemoteIdUnsafe,
  RemoteEntry,
  type RemoteId
} from "./EventJournal.ts"
import * as EventLog from "./EventLog.ts"

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
 * @category context
 */
export class StoreMapping extends ServiceMap.Service<StoreMapping, {
  readonly resolve: (publicKey: string) => Effect.Effect<StoreId, EventLogServerStoreError>
  readonly assign: (options: {
    readonly publicKey: string
    readonly storeId: StoreId
  }) => Effect.Effect<void, EventLogServerStoreError>
  readonly hasStore: (storeId: StoreId) => Effect.Effect<boolean, EventLogServerStoreError>
}>()("effect/eventlog/EventLogServerUnencrypted/StoreMapping") {}

class PersistedStoreMapping extends Schema.Class<PersistedStoreMapping>(
  "effect/eventlog/EventLogServerUnencrypted/PersistedStoreMapping"
)({
  storeId: StoreId
}) {}

class PersistedStoreProvision extends Schema.Class<PersistedStoreProvision>(
  "effect/eventlog/EventLogServerUnencrypted/PersistedStoreProvision"
)({
  provisioned: Schema.Literal(true)
}) {}

const decodePersistedStoreMapping = Schema.decodeUnknownEffect(PersistedStoreMapping)
const decodePersistedStoreProvision = Schema.decodeUnknownEffect(PersistedStoreProvision)

const toNotFoundError = (publicKey: string) =>
  new EventLogServerStoreError({
    reason: "NotFound",
    publicKey,
    message: `No store mapping found for public key: ${publicKey}`
  })

const toStoreNotFoundError = (storeId: StoreId) =>
  new EventLogServerStoreError({
    reason: "NotFound",
    storeId,
    message: `No provisioned store found for store id: ${storeId}`
  })

const toPersistenceFailure = (options: {
  readonly publicKey?: string | undefined
  readonly storeId?: StoreId | undefined
  readonly message: string
}) =>
(cause: unknown) =>
  new EventLogServerStoreError({
    reason: "PersistenceFailure",
    publicKey: options.publicKey,
    storeId: options.storeId,
    message: cause instanceof Error ? `${options.message}: ${cause.message}` : options.message
  })

/**
 * @since 4.0.0
 * @category store
 */
export const makeStoreMappingMemory: Effect.Effect<StoreMapping["Service"]> = Effect.sync(() => {
  const mappings = new Map<string, StoreId>()
  const knownStores = new Set<string>()

  return StoreMapping.of({
    resolve: Effect.fnUntraced(function*(publicKey: string) {
      const storeId = mappings.get(publicKey)
      if (storeId !== undefined) {
        return storeId
      }
      return yield* Effect.fail(toNotFoundError(publicKey))
    }),
    assign: Effect.fnUntraced(function*({ publicKey, storeId }) {
      mappings.set(publicKey, storeId)
      knownStores.add(toStoreKey(storeId))
    }),
    hasStore: Effect.fnUntraced(function*(storeId: StoreId) {
      return knownStores.has(toStoreKey(storeId))
    })
  })
})

/**
 * @since 4.0.0
 * @category store
 */
export const layerStoreMappingMemory: Layer.Layer<StoreMapping> = Layer.effect(StoreMapping)(makeStoreMappingMemory)

/**
 * @since 4.0.0
 * @category store
 */
export const makeStoreMappingPersisted = Effect.fnUntraced(function*(options: {
  readonly storeId: string
}) {
  const backing = yield* Persistence.BackingPersistence
  const storage = yield* backing.make(options.storeId)
  const toPersistedMappingKey = (publicKey: string): string => `@mapping/${publicKey}`
  const toStoreProvisionKey = (storeId: StoreId): string => `@store/${toStoreKey(storeId)}`

  return StoreMapping.of({
    resolve: Effect.fnUntraced(function*(publicKey: string) {
      const encoded = yield* storage.get(toPersistedMappingKey(publicKey)).pipe(
        Effect.mapError(
          toPersistenceFailure({
            publicKey,
            message: `Failed to resolve store mapping for public key: ${publicKey}`
          })
        )
      )
      const legacyEncoded = encoded === undefined
        ? yield* storage.get(publicKey).pipe(
          Effect.mapError(
            toPersistenceFailure({
              publicKey,
              message: `Failed to resolve legacy store mapping for public key: ${publicKey}`
            })
          )
        )
        : undefined
      const encodedMapping = encoded ?? legacyEncoded
      if (encodedMapping === undefined) {
        return yield* Effect.fail(toNotFoundError(publicKey))
      }

      const decoded = yield* decodePersistedStoreMapping(encodedMapping).pipe(
        Effect.mapError(
          toPersistenceFailure({
            publicKey,
            message: `Failed to decode store mapping for public key: ${publicKey}`
          })
        )
      )

      yield* storage.get(toStoreProvisionKey(decoded.storeId)).pipe(
        Effect.mapError(
          toPersistenceFailure({
            publicKey,
            storeId: decoded.storeId,
            message: `Failed to resolve store provisioning for public key: ${publicKey}`
          })
        )
      ).pipe(
        Effect.flatMap((encoded) =>
          encoded === undefined
            ? storage.set(
              toStoreProvisionKey(decoded.storeId),
              new PersistedStoreProvision({ provisioned: true }),
              undefined
            ).pipe(
              Effect.mapError(
                toPersistenceFailure({
                  publicKey,
                  storeId: decoded.storeId,
                  message: `Failed to backfill store provisioning for public key: ${publicKey}`
                })
              ),
              Effect.asVoid
            )
            : decodePersistedStoreProvision(encoded).pipe(
              Effect.mapError(
                toPersistenceFailure({
                  publicKey,
                  storeId: decoded.storeId,
                  message: `Failed to decode store provisioning for public key: ${publicKey}`
                })
              )
            )
        )
      )

      return decoded.storeId
    }),
    assign: Effect.fnUntraced(function*({ publicKey, storeId }) {
      yield* storage.set(toPersistedMappingKey(publicKey), new PersistedStoreMapping({ storeId }), undefined).pipe(
        Effect.mapError(
          toPersistenceFailure({
            publicKey,
            storeId,
            message: `Failed to assign store mapping for public key: ${publicKey}`
          })
        )
      )

      yield* storage.set(
        toStoreProvisionKey(storeId),
        new PersistedStoreProvision({ provisioned: true }),
        undefined
      ).pipe(
        Effect.mapError(
          toPersistenceFailure({
            publicKey,
            storeId,
            message: `Failed to persist store provisioning for public key: ${publicKey}`
          })
        )
      )
    }),
    hasStore: Effect.fnUntraced(function*(storeId: StoreId) {
      const encoded = yield* storage.get(toStoreProvisionKey(storeId)).pipe(
        Effect.mapError(
          toPersistenceFailure({
            storeId,
            message: `Failed to resolve store provisioning for store id: ${storeId}`
          })
        )
      )
      if (encoded === undefined) {
        return false
      }

      const decoded = yield* decodePersistedStoreProvision(encoded).pipe(
        Effect.mapError(
          toPersistenceFailure({
            storeId,
            message: `Failed to decode store provisioning for store id: ${storeId}`
          })
        )
      )

      return decoded.provisioned
    })
  })
})

/**
 * @since 4.0.0
 * @category store
 */
export const layerStoreMappingPersisted = (options: {
  readonly storeId: string
}): Layer.Layer<StoreMapping, never, Persistence.BackingPersistence> =>
  Layer.effect(StoreMapping)(makeStoreMappingPersisted(options))

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

/**
 * @since 4.0.0
 * @category runtime
 */
export class EventLogServerUnencrypted extends ServiceMap.Service<EventLogServerUnencrypted, {
  readonly ingest: (options: {
    readonly publicKey: string
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<{
    readonly storeId: StoreId
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }, EventLogServerAuthError | EventLogServerStoreError | EventJournal.EventJournalError>
  readonly write: <Groups extends EventGroup.Any, Tag extends Event.Tag<EventGroup.Events<Groups>>>(options: {
    readonly schema: EventLog.EventLogSchema<Groups>
    readonly storeId: StoreId
    readonly event: Tag
    readonly payload: Event.PayloadWithTag<EventGroup.Events<Groups>, Tag>
    readonly entryId?: EntryId | undefined
  }) => Effect.Effect<void, EventLogServerStoreError | EventJournal.EventJournalError>
  readonly requestChanges: (
    publicKey: string,
    startSequence: number
  ) => Effect.Effect<
    Queue.Dequeue<RemoteEntry, Cause.Done>,
    EventLogServerAuthError | EventLogServerStoreError | EventJournal.EventJournalError,
    Scope.Scope
  >
  readonly registerCompaction: (options: {
    readonly events: ReadonlyArray<string>
    readonly effect: (options: {
      readonly entries: ReadonlyArray<Entry>
      readonly write: (entry: Entry) => Effect.Effect<void>
    }) => Effect.Effect<void>
  }) => Effect.Effect<void, never, Scope.Scope>
  readonly registerReactivity: (keys: Record<string, ReadonlyArray<string>>) => Effect.Effect<void, never, Scope.Scope>
}>()("effect/eventlog/EventLogServerUnencrypted") {}

const toStoreKey = (storeId: StoreId): string => storeId as string

const storeRemoteNamespace = "9e2f4ec9-ea57-44cc-ad6f-0f97d7f59fb5"

const makeStoreRemoteId = (storeId: StoreId): RemoteId =>
  Uuid.v5(toStoreKey(storeId), storeRemoteNamespace, new Uint8Array(16)) as RemoteId

const makeClientIdentity = (publicKey: string): EventLog.Identity["Service"] => ({
  publicKey,
  privateKey: Redacted.make(new Uint8Array(32))
})

const makeRecoveryIdentityPublicKey = (storeId: StoreId): string =>
  `effect-eventlog-server-recovery:${toStoreKey(storeId)}`

const makeServerWriteIdentityPublicKey = (storeId: StoreId): string =>
  `effect-eventlog-server-write:${toStoreKey(storeId)}`

const toReconciliationStartSequence = (nextRemoteSequence: number): number =>
  nextRemoteSequence <= 0 ? 0 : nextRemoteSequence - 1

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

        const backlog = entriesAfter(ensureJournal(storeId), startSequence)
        const replayedUpTo = backlog.length > 0 ? backlog[backlog.length - 1].remoteSequence : startSequence

        yield* Queue.offerAll(queue, backlog)
        yield* PubSub.takeAll(subscription).pipe(
          Effect.flatMap((chunk) =>
            Queue.offerAll(queue, chunk.filter((entry) => entry.remoteSequence > replayedUpTo))
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

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = Effect.gen(function*() {
  const journal = yield* EventJournal.EventJournal
  const storage = yield* Storage
  const mapping = yield* StoreMapping
  const auth = yield* EventLogServerAuth
  const services = yield* Effect.services<never>()
  const reactivity = yield* Reactivity

  const compactors = new Map<string, {
    readonly events: ReadonlySet<string>
    readonly effect: (options: {
      readonly entries: ReadonlyArray<Entry>
      readonly write: (entry: Entry) => Effect.Effect<void>
    }) => Effect.Effect<void>
  }>()
  const reactivityKeys: Record<string, ReadonlyArray<string>> = {}
  const reconciledStores = new Set<string>()
  const journalSemaphore = yield* Semaphore.make(1)

  const replayCommitted = Effect.fnUntraced(function*(options: {
    readonly storeId: StoreId
    readonly publicKey: string
    readonly committed: ReadonlyArray<RemoteEntry>
  }) {
    if (options.committed.length === 0) {
      return
    }

    const replayFromRemote = EventLog.makeReplayFromRemoteEffect({
      services,
      identity: makeClientIdentity(options.publicKey),
      reactivity,
      reactivityKeys,
      logAnnotations: {
        service: "EventLogServerUnencrypted",
        effect: "writeFromRemote"
      }
    })

    yield* journalSemaphore.withPermits(1)(
      journal.writeFromRemote({
        remoteId: makeStoreRemoteId(options.storeId),
        entries: options.committed,
        effect: replayFromRemote
      })
    )
  })

  const reconcileStore = Effect.fnUntraced(function*(storeId: StoreId) {
    const storeKey = toStoreKey(storeId)
    if (reconciledStores.has(storeKey)) {
      return
    }

    const remoteId = makeStoreRemoteId(storeId)
    const nextRemoteSequence = yield* journal.nextRemoteSequence(remoteId)
    const startSequence = toReconciliationStartSequence(nextRemoteSequence)
    const missing = yield* storage.entries(storeId, startSequence)

    if (missing.length === 0) {
      yield* Effect.sync(() => {
        reconciledStores.add(storeKey)
      })
      return
    }

    yield* replayCommitted({
      storeId,
      publicKey: makeRecoveryIdentityPublicKey(storeId),
      committed: missing
    })

    yield* Effect.sync(() => {
      reconciledStores.add(storeKey)
    })
  })

  const markStoreNeedsReconciliation = (storeId: StoreId): Effect.Effect<void> =>
    Effect.sync(() => {
      reconciledStores.delete(toStoreKey(storeId))
    })

  const markStoreReconciled = (storeId: StoreId): Effect.Effect<void> =>
    Effect.sync(() => {
      reconciledStores.add(toStoreKey(storeId))
    })

  const replayCommittedForIngest = Effect.fnUntraced(function*(options: {
    readonly storeId: StoreId
    readonly publicKey: string
    readonly committed: ReadonlyArray<RemoteEntry>
  }) {
    if (options.committed.length === 0) {
      return
    }

    yield* replayCommitted(options).pipe(
      Effect.tapError(() => markStoreNeedsReconciliation(options.storeId))
    )
    yield* markStoreReconciled(options.storeId)
  })

  const persistAndReplay = Effect.fnUntraced(function*(options: {
    readonly storeId: StoreId
    readonly publicKey: string
    readonly entries: ReadonlyArray<Entry>
  }) {
    yield* reconcileStore(options.storeId)

    const persisted = yield* storage.write(options.storeId, options.entries)
    yield* replayCommittedForIngest({
      storeId: options.storeId,
      publicKey: options.publicKey,
      committed: persisted.committed
    })

    return persisted
  })

  const findSchemaEvent = <Groups extends EventGroup.Any>(
    schema: EventLog.EventLogSchema<Groups>,
    event: string
  ): Event.AnyWithProps | undefined => {
    for (const group of schema.groups as unknown as ReadonlyArray<EventGroup.EventGroup<Event.Any>>) {
      const schemaEvent = group.events[event]
      if (schemaEvent !== undefined) {
        return schemaEvent
      }
    }

    return undefined
  }

  const ensureStoreExists = Effect.fnUntraced(function*(storeId: StoreId) {
    const provisioned = yield* mapping.hasStore(storeId)
    if (provisioned) {
      return
    }

    const existing = yield* storage.entries(storeId, 0)
    if (existing.length > 0) {
      return
    }

    return yield* Effect.fail(toStoreNotFoundError(storeId))
  })

  const serverWrite = Effect.fnUntraced(function*(options: {
    readonly schema: EventLog.EventLogSchema<any>
    readonly storeId: StoreId
    readonly event: string
    readonly payload: unknown
    readonly entryId?: EntryId | undefined
  }) {
    yield* ensureStoreExists(options.storeId)

    const schemaEvent = findSchemaEvent(options.schema, options.event)
    if (schemaEvent === undefined) {
      return yield* Effect.die(`Event schema not found for: "${options.event}"`)
    }

    const payload = yield* Schema.encodeUnknownEffect(schemaEvent.payloadMsgPack)(options.payload).pipe(
      Effect.orDie
    )

    const entry = new EventJournal.Entry({
      id: options.entryId ?? makeEntryIdUnsafe(),
      event: options.event,
      primaryKey: schemaEvent.primaryKey(options.payload),
      payload
    }, { disableChecks: true })

    yield* persistAndReplay({
      storeId: options.storeId,
      publicKey: makeServerWriteIdentityPublicKey(options.storeId),
      entries: [entry]
    })
  })

  return EventLogServerUnencrypted.of({
    ingest: Effect.fnUntraced(function*({ publicKey, entries }) {
      const storeId = yield* mapping.resolve(publicKey)
      yield* auth.authorizeWrite({
        publicKey,
        storeId,
        entries
      })

      const persisted = yield* persistAndReplay({
        storeId,
        publicKey,
        entries
      })

      return {
        storeId,
        sequenceNumbers: persisted.sequenceNumbers,
        committed: persisted.committed
      }
    }),
    write: serverWrite as EventLogServerUnencrypted["Service"]["write"],
    requestChanges: Effect.fnUntraced(function*(publicKey: string, startSequence: number) {
      const storeId = yield* mapping.resolve(publicKey)
      yield* auth.authorizeRead({
        publicKey,
        storeId
      })

      yield* reconcileStore(storeId)

      return yield* storage.changes(storeId, startSequence)
    }),
    registerCompaction: (options) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const events = new Set(options.events)
          const compactor = {
            events,
            effect: options.effect
          }
          for (const event of options.events) {
            compactors.set(event, compactor)
          }
        }),
        () =>
          Effect.sync(() => {
            for (const event of options.events) {
              compactors.delete(event)
            }
          })
      ),
    registerReactivity: (keys) =>
      Effect.sync(() => {
        Object.assign(reactivityKeys, keys)
      })
  })
})

/**
 * @since 4.0.0
 * @category reactivity
 */
export const groupReactivity = <Events extends Event.Any>(
  group: EventGroup.EventGroup<Events>,
  keys:
    | { readonly [Tag in Event.Tag<Events>]?: ReadonlyArray<string> }
    | ReadonlyArray<string>
): Layer.Layer<never, never, EventLogServerUnencrypted> =>
  Layer.effectDiscard(
    Effect.gen(function*() {
      const runtime = yield* EventLogServerUnencrypted
      if (!Array.isArray(keys)) {
        yield* runtime.registerReactivity(keys as Record<string, ReadonlyArray<string>>)
        return
      }

      const all: Record<string, ReadonlyArray<string>> = {}
      for (const tag in group.events) {
        all[tag] = keys
      }
      yield* runtime.registerReactivity(all)
    })
  )

const layerServerRuntime: Layer.Layer<
  EventLogServerUnencrypted,
  never,
  EventJournal.EventJournal | Storage | StoreMapping | EventLogServerAuth
> = Layer.effect(EventLogServerUnencrypted, make).pipe(
  Layer.provide(ReactivityLayer.layer)
)

/**
 * @since 4.0.0
 * @category layers
 */
export const layer = <Groups extends EventGroup.Any>(
  _schema: EventLog.EventLogSchema<Groups>
): Layer.Layer<
  EventLogServerUnencrypted,
  never,
  EventGroup.ToService<Groups> | EventJournal.EventJournal | Storage | StoreMapping | EventLogServerAuth
> =>
  layerServerRuntime as Layer.Layer<
    EventLogServerUnencrypted,
    never,
    EventGroup.ToService<Groups> | EventJournal.EventJournal | Storage | StoreMapping | EventLogServerAuth
  >
