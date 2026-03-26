/**
 * @since 4.0.0
 */
import type { Brand } from "../../Brand.ts"
import type * as Cause from "../../Cause.ts"
import * as Data from "../../Data.ts"
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as FiberMap from "../../FiberMap.ts"
import * as Layer from "../../Layer.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as Semaphore from "../../Semaphore.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as HttpServerError from "../http/HttpServerError.ts"
import * as HttpServerRequest from "../http/HttpServerRequest.ts"
import * as HttpServerResponse from "../http/HttpServerResponse.ts"
import * as Persistence from "../persistence/Persistence.ts"
import { Reactivity } from "../reactivity/Reactivity.ts"
import * as ReactivityLayer from "../reactivity/Reactivity.ts"
import type * as Socket from "../socket/Socket.ts"
import type * as Event from "./Event.ts"
import type * as EventGroup from "./EventGroup.ts"
import * as EventJournal from "./EventJournal.ts"
import {
  Entry,
  type EntryId,
  makeEntryIdUnsafe,
  makeRemoteIdUnsafe,
  RemoteEntry,
  type RemoteId
} from "./EventJournal.ts"
import * as EventLog from "./EventLog.ts"
import {
  Ack,
  ChangesUnencrypted,
  ChunkedMessage,
  decodeRequestUnencrypted,
  encodeResponseUnencrypted,
  ErrorUnencrypted,
  Hello,
  Pong,
  type ProtocolRequestUnencrypted,
  type ProtocolResponseUnencrypted
} from "./EventLogRemote.ts"

const constChunkSize = 512_000

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
export const makeStoreMappingMemory = (options?: {
  readonly mappings?: Iterable<readonly [publicKey: string, storeId: StoreId]> | undefined
  readonly stores?: Iterable<StoreId> | undefined
}): Effect.Effect<StoreMapping["Service"]> =>
  Effect.sync(() => {
    const mappings = new Map(options?.mappings)
    const knownStores = new Set<string>()

    for (const storeId of options?.stores ?? []) {
      knownStores.add(toStoreKey(storeId))
    }
    for (const storeId of mappings.values()) {
      knownStores.add(toStoreKey(storeId))
    }

    return StoreMapping.of({
      resolve: Effect.fnUntraced(function*(publicKey: string) {
        const storeId = mappings.get(publicKey)
        if (storeId !== undefined) {
          return storeId
        }
        return yield* Effect.fail(toNotFoundError(publicKey))
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
export const makeStoreMapping = Effect.fnUntraced(function*(options: {
  readonly resolve: (publicKey: string) => Effect.Effect<StoreId, EventLogServerStoreError>
  readonly hasStore: (storeId: StoreId) => Effect.Effect<boolean, EventLogServerStoreError>
}) {
  return StoreMapping.of({
    resolve: options.resolve,
    hasStore: options.hasStore
  })
})

/**
 * @since 4.0.0
 * @category store
 */
export const layerStoreMappingResolver = (options: {
  readonly resolve: (publicKey: string) => Effect.Effect<StoreId, EventLogServerStoreError>
  readonly hasStore: (storeId: StoreId) => Effect.Effect<boolean, EventLogServerStoreError>
}): Layer.Layer<StoreMapping> => Layer.effect(StoreMapping)(makeStoreMapping(options))

/**
 * @since 4.0.0
 * @category store
 */
export const layerStoreMappingStatic = (options: {
  readonly storeId: StoreId
}): Layer.Layer<StoreMapping> =>
  layerStoreMappingResolver({
    resolve: Effect.fnUntraced(function*(_publicKey: string) {
      return options.storeId
    }),
    hasStore: Effect.fnUntraced(function*(storeId: StoreId) {
      return storeId === options.storeId
    })
  })

/**
 * @since 4.0.0
 * @category store
 */
export const layerStoreMappingMemory = (options?: {
  readonly mappings?: Iterable<readonly [publicKey: string, storeId: StoreId]> | undefined
  readonly stores?: Iterable<StoreId> | undefined
}): Layer.Layer<StoreMapping> => Layer.effect(StoreMapping)(makeStoreMappingMemory(options))

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

      return decoded.storeId
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
  readonly processedSequence: (storeId: StoreId) => Effect.Effect<number>
  readonly markProcessed: (
    storeId: StoreId,
    remoteSequence: number
  ) => Effect.Effect<void>
}>()("effect/eventlog/EventLogServerUnencrypted/Storage") {}

/**
 * @since 4.0.0
 * @category runtime
 */
export class EventLogServerUnencrypted extends ServiceMap.Service<EventLogServerUnencrypted, {
  readonly getId: Effect.Effect<RemoteId>
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
    readonly olderThan: Duration.Input
    readonly effect: (options: {
      readonly entries: ReadonlyArray<Entry>
      readonly write: (entry: Entry) => Effect.Effect<void>
    }) => Effect.Effect<void>
  }) => Effect.Effect<void, never, Scope.Scope>
  readonly registerReactivity: (keys: Record<string, ReadonlyArray<string>>) => Effect.Effect<void, never, Scope.Scope>
}>()("effect/eventlog/EventLogServerUnencrypted") {}

const toStoreKey = (storeId: StoreId): string => storeId as string

type ProtocolErrorCode = "Unauthorized" | "Forbidden" | "NotFound" | "InvalidRequest" | "InternalServerError"

const toProtocolErrorCode = (
  error: EventLogServerAuthError | EventLogServerStoreError
): ProtocolErrorCode => {
  if (error._tag === "EventLogServerAuthError") {
    return error.reason
  }

  switch (error.reason) {
    case "NotFound": {
      return "NotFound"
    }
    case "PersistenceFailure": {
      return "InternalServerError"
    }
  }
}

const toProtocolErrorMessage = (error: EventLogServerAuthError | EventLogServerStoreError): string => {
  if (error.message !== undefined) {
    return error.message
  }

  if (error._tag === "EventLogServerAuthError") {
    return error.reason === "Unauthorized"
      ? "Unauthorized request"
      : "Forbidden request"
  }

  return error.reason === "NotFound"
    ? "Store mapping not found"
    : "Internal server error"
}

const makeClientIdentity = (publicKey: string): EventLog.Identity["Service"] => ({
  publicKey,
  privateKey: Redacted.make(new Uint8Array(32))
})

const makeRecoveryIdentityPublicKey = (storeId: StoreId): string =>
  `effect-eventlog-server-recovery:${toStoreKey(storeId)}`

const makeServerWriteIdentityPublicKey = (storeId: StoreId): string =>
  `effect-eventlog-server-write:${toStoreKey(storeId)}`

const entriesAfter = (journal: Array<RemoteEntry>, startSequence: number): ReadonlyArray<RemoteEntry> =>
  journal.filter((entry) => entry.remoteSequence > startSequence)

type StoreProcessingState = {
  readonly semaphore: Semaphore.Semaphore
  loadedProcessedSequence: number
  readonly processedEntriesByCreatedAt: Array<Entry>
}

const insertEntryByCreatedAt = (history: Array<Entry>, entry: Entry): void => {
  let index = history.length
  while (index > 0 && history[index - 1]!.createdAtMillis > entry.createdAtMillis) {
    index--
  }
  history.splice(index, 0, entry)
}

const toConflicts = (history: ReadonlyArray<Entry>, originEntry: Entry): ReadonlyArray<Entry> => {
  for (let i = history.length - 1; i >= -1; i--) {
    const entry = history[i]
    if (entry !== undefined && entry.createdAtMillis > originEntry.createdAtMillis) {
      continue
    }

    const conflicts: Array<Entry> = []
    for (let j = i + 2; j < history.length; j++) {
      const scannedEntry = history[j]!
      if (scannedEntry.event === originEntry.event && scannedEntry.primaryKey === originEntry.primaryKey) {
        conflicts.push(scannedEntry)
      }
    }
    return conflicts
  }

  return []
}

type RegisteredCompactor = {
  readonly events: ReadonlySet<string>
  readonly olderThanMillis: number
  readonly effect: (options: {
    readonly entries: ReadonlyArray<Entry>
    readonly write: (entry: Entry) => Effect.Effect<void>
  }) => Effect.Effect<void>
}

const isEligibleForCompaction = (options: {
  readonly remoteEntry: RemoteEntry
  readonly nowMillis: number
  readonly olderThanMillis: number
}): boolean => options.remoteEntry.entry.createdAtMillis <= options.nowMillis - options.olderThanMillis

const representativeSequences = (options: {
  readonly remoteEntries: ReadonlyArray<RemoteEntry>
  readonly compactedCount: number
}): ReadonlyArray<number> | undefined => {
  if (options.compactedCount === 0) {
    return []
  }
  if (options.compactedCount > options.remoteEntries.length) {
    return undefined
  }

  const maxSequence = options.remoteEntries[options.remoteEntries.length - 1]!.remoteSequence
  if (options.compactedCount === 1) {
    return [maxSequence]
  }

  const selected = options.remoteEntries
    .slice(0, options.compactedCount - 1)
    .map((entry) => entry.remoteSequence)
  selected.push(maxSequence)
  for (let i = 1; i < selected.length; i++) {
    if (selected[i]! <= selected[i - 1]!) {
      return undefined
    }
  }
  return selected
}

const toCompactedRemoteEntries = (options: {
  readonly compacted: ReadonlyArray<Entry>
  readonly remoteEntries: ReadonlyArray<RemoteEntry>
}): ReadonlyArray<RemoteEntry> | undefined => {
  const sequences = representativeSequences({
    remoteEntries: options.remoteEntries,
    compactedCount: options.compacted.length
  })
  if (sequences === undefined) {
    return undefined
  }

  return options.compacted.map((entry, index) =>
    new RemoteEntry({
      remoteSequence: sequences[index]!,
      entry
    }, { disableChecks: true })
  )
}

const compactBacklog = Effect.fnUntraced(function*(options: {
  readonly remoteEntries: ReadonlyArray<RemoteEntry>
  readonly compactors: ReadonlyMap<string, RegisteredCompactor>
  readonly nowMillis: number
}) {
  if (options.compactors.size === 0 || options.remoteEntries.length === 0) {
    return options.remoteEntries
  }

  const compactedRemoteEntries: Array<RemoteEntry> = []
  let index = 0

  while (index < options.remoteEntries.length) {
    const remoteEntry = options.remoteEntries[index]!
    const compactor = options.compactors.get(remoteEntry.entry.event)
    if (
      compactor === undefined ||
      !isEligibleForCompaction({
        remoteEntry,
        nowMillis: options.nowMillis,
        olderThanMillis: compactor.olderThanMillis
      })
    ) {
      compactedRemoteEntries.push(remoteEntry)
      index++
      continue
    }

    const entries: Array<Entry> = [remoteEntry.entry]
    const remoteGroup: Array<RemoteEntry> = [remoteEntry]
    const compacted: Array<Entry> = []
    index++

    while (index < options.remoteEntries.length) {
      const nextRemoteEntry = options.remoteEntries[index]!
      const nextCompactor = options.compactors.get(nextRemoteEntry.entry.event)
      if (
        nextCompactor !== compactor ||
        !isEligibleForCompaction({
          remoteEntry: nextRemoteEntry,
          nowMillis: options.nowMillis,
          olderThanMillis: compactor.olderThanMillis
        })
      ) {
        break
      }
      entries.push(nextRemoteEntry.entry)
      remoteGroup.push(nextRemoteEntry)
      index++
    }

    yield* compactor.effect({
      entries,
      write(entry) {
        return Effect.sync(() => {
          compacted.push(entry)
        })
      }
    }).pipe(Effect.orDie)

    const projected = toCompactedRemoteEntries({
      compacted,
      remoteEntries: remoteGroup
    })

    if (projected === undefined) {
      compactedRemoteEntries.push(...remoteGroup)
      continue
    }
    compactedRemoteEntries.push(...projected)
  }

  return compactedRemoteEntries
})

/**
 * @since 4.0.0
 * @category storage
 */
export const makeStorageMemory: Effect.Effect<Storage["Service"], never, Scope.Scope> = Effect.gen(function*() {
  const knownIds = new Map<string, Map<string, number>>()
  const journals = new Map<string, Array<RemoteEntry>>()
  const processedSequences = new Map<string, number>()
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
    write: Effect.fnUntraced(function*(storeId, entries) {
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
    }, Effect.scoped),
    entries: (storeId, startSequence) => Effect.sync(() => entriesAfter(ensureJournal(storeId), startSequence)),
    changes: Effect.fnUntraced(function*(storeId, startSequence) {
      const storeKey = toStoreKey(storeId)
      const queue = yield* Queue.make<RemoteEntry>()
      const pubsub = yield* RcMap.get(pubsubs, storeKey)
      const subscription = yield* PubSub.subscribe(pubsub)

      const backlog = entriesAfter(ensureJournal(storeId), startSequence)
      const replayedUpTo = backlog.length > 0 ? backlog[backlog.length - 1].remoteSequence : startSequence

      yield* Queue.offerAll(queue, backlog)
      yield* PubSub.takeAll(subscription).pipe(
        Effect.flatMap((chunk) => Queue.offerAll(queue, chunk.filter((entry) => entry.remoteSequence > replayedUpTo))),
        Effect.forever,
        Effect.forkScoped
      )

      yield* Effect.addFinalizer(() => Queue.shutdown(queue))
      return Queue.asDequeue(queue)
    }),
    processedSequence: (storeId) => Effect.sync(() => processedSequences.get(toStoreKey(storeId)) ?? 0),
    markProcessed: (storeId, remoteSequence) =>
      Effect.sync(() => {
        const storeKey = toStoreKey(storeId)
        const current = processedSequences.get(storeKey) ?? 0
        if (remoteSequence > current) {
          processedSequences.set(storeKey, remoteSequence)
        }
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
  yield* EventJournal.EventJournal
  const storage = yield* Storage
  const mapping = yield* StoreMapping
  const auth = yield* EventLogServerAuth
  const services = yield* Effect.services<never>()
  const reactivity = yield* Reactivity

  const compactors = new Map<string, RegisteredCompactor>()
  const reactivityKeys: Record<string, ReadonlyArray<string>> = {}
  const storeProcessingState = new Map<string, StoreProcessingState>()
  const storeProcessingStateSemaphore = yield* Semaphore.make(1)

  const getStoreProcessingState = Effect.fnUntraced(function*(storeId: StoreId) {
    const storeKey = toStoreKey(storeId)
    const existing = storeProcessingState.get(storeKey)
    if (existing !== undefined) {
      return existing
    }

    return yield* storeProcessingStateSemaphore.withPermits(1)(
      Effect.gen(function*() {
        const inLock = storeProcessingState.get(storeKey)
        if (inLock !== undefined) {
          return inLock
        }

        const created: StoreProcessingState = {
          semaphore: yield* Semaphore.make(1),
          loadedProcessedSequence: 0,
          processedEntriesByCreatedAt: []
        }
        yield* Effect.sync(() => {
          storeProcessingState.set(storeKey, created)
        })
        return created
      })
    )
  })

  const processStoreFromStorage = Effect.fnUntraced(function*(options: {
    readonly storeId: StoreId
    readonly publicKey: string
    readonly storeState: StoreProcessingState
  }) {
    const checkpoint = yield* storage.processedSequence(options.storeId)

    if (options.storeState.loadedProcessedSequence > checkpoint) {
      const replayed = yield* storage.entries(options.storeId, 0)
      yield* Effect.sync(() => {
        options.storeState.processedEntriesByCreatedAt.length = 0
        options.storeState.loadedProcessedSequence = 0
        for (const remoteEntry of replayed) {
          if (remoteEntry.remoteSequence > checkpoint) {
            break
          }
          insertEntryByCreatedAt(options.storeState.processedEntriesByCreatedAt, remoteEntry.entry)
          options.storeState.loadedProcessedSequence = remoteEntry.remoteSequence
        }
      })
    } else if (options.storeState.loadedProcessedSequence < checkpoint) {
      const replayed = yield* storage.entries(options.storeId, options.storeState.loadedProcessedSequence)
      yield* Effect.sync(() => {
        for (const remoteEntry of replayed) {
          if (remoteEntry.remoteSequence > checkpoint) {
            break
          }
          insertEntryByCreatedAt(options.storeState.processedEntriesByCreatedAt, remoteEntry.entry)
          options.storeState.loadedProcessedSequence = remoteEntry.remoteSequence
        }
      })
    }

    const pending = (yield* storage.entries(options.storeId, checkpoint)).slice().sort((a, b) =>
      a.remoteSequence - b.remoteSequence
    )
    if (pending.length === 0) {
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

    const newlyProcessed: Array<RemoteEntry> = []
    for (const remoteEntry of pending) {
      const conflicts = toConflicts(options.storeState.processedEntriesByCreatedAt, remoteEntry.entry)
      yield* replayFromRemote({
        entry: remoteEntry.entry,
        conflicts
      })
      yield* storage.markProcessed(options.storeId, remoteEntry.remoteSequence)
      newlyProcessed.push(remoteEntry)
    }

    yield* Effect.sync(() => {
      for (const remoteEntry of newlyProcessed) {
        insertEntryByCreatedAt(options.storeState.processedEntriesByCreatedAt, remoteEntry.entry)
        if (remoteEntry.remoteSequence > options.storeState.loadedProcessedSequence) {
          options.storeState.loadedProcessedSequence = remoteEntry.remoteSequence
        }
      }
    })
  })

  const withStoreProcessingLock = Effect.fnUntraced(function*<A, E, R>(
    storeId: StoreId,
    effect: (storeState: StoreProcessingState) => Effect.Effect<A, E, R>
  ): Effect.fn.Return<A, E, R> {
    const storeState = yield* getStoreProcessingState(storeId)
    return yield* storeState.semaphore.withPermits(1)(effect(storeState))
  })

  const persistAndReplay = Effect.fnUntraced(function*(options: {
    readonly storeId: StoreId
    readonly publicKey: string
    readonly entries: ReadonlyArray<Entry>
  }) {
    return yield* withStoreProcessingLock(options.storeId, (storeState) =>
      Effect.gen(function*() {
        yield* processStoreFromStorage({
          storeId: options.storeId,
          publicKey: makeRecoveryIdentityPublicKey(options.storeId),
          storeState
        })

        const persisted = yield* storage.write(options.storeId, options.entries)

        yield* processStoreFromStorage({
          storeId: options.storeId,
          publicKey: options.publicKey,
          storeState
        })

        return persisted
      }))
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
    getId: storage.getId,
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

      yield* withStoreProcessingLock(storeId, (storeState) =>
        processStoreFromStorage({
          storeId,
          publicKey: makeRecoveryIdentityPublicKey(storeId),
          storeState
        }))

      const backlog = yield* storage.entries(storeId, 0)
      const projectedBacklog = yield* compactBacklog({
        remoteEntries: backlog,
        compactors,
        nowMillis: Date.now()
      }).pipe(
        Effect.map((entries) => entries.filter((entry) => entry.remoteSequence > startSequence))
      )

      const queue = yield* Queue.make<RemoteEntry>()
      yield* Queue.offerAll(queue, projectedBacklog)

      const backlogSequence = backlog.length > 0 ? backlog[backlog.length - 1]!.remoteSequence : 0
      const liveChanges = yield* storage.changes(storeId, backlogSequence)
      yield* Queue.takeAll(liveChanges).pipe(
        Effect.flatMap((entries) =>
          Queue.offerAll(queue, entries.filter((entry) => entry.remoteSequence > startSequence))
        ),
        Effect.forever,
        Effect.forkScoped
      )

      yield* Effect.addFinalizer(() => Queue.shutdown(queue))
      return Queue.asDequeue(queue)
    }),
    registerCompaction: (options) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const olderThanMillis = Math.max(
            Duration.toMillis(Duration.fromInputUnsafe(options.olderThan)),
            0
          )
          const events = new Set(options.events)
          const compactor = {
            events,
            olderThanMillis,
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

/**
 * @since 4.0.0
 * @category compaction
 */
export const groupCompaction = <Events extends Event.Any, R>(
  group: EventGroup.EventGroup<Events>,
  options: {
    readonly olderThan: Duration.Input
  },
  effect: (options: {
    readonly primaryKey: string
    readonly entries: ReadonlyArray<Entry>
    readonly events: ReadonlyArray<Event.TaggedPayload<Events>>
    readonly write: <Tag extends Event.Tag<Events>>(
      tag: Tag,
      payload: Event.PayloadWithTag<Events, Tag>
    ) => Effect.Effect<void, never, Event.PayloadSchemaWithTag<Events, Tag>["EncodingServices"]>
  }) => Effect.Effect<void, never, R>
): Layer.Layer<
  never,
  never,
  EventLogServerUnencrypted | R | Event.PayloadSchema<Events>["DecodingServices"]
> =>
  Layer.effectDiscard(
    Effect.gen(function*() {
      const runtime = yield* EventLogServerUnencrypted
      const services = yield* Effect.services<R | Event.PayloadSchema<Events>["DecodingServices"]>()

      yield* runtime.registerCompaction({
        events: Object.keys(group.events),
        olderThan: options.olderThan,
        effect: Effect.fnUntraced(function*({ entries, write }): Effect.fn.Return<void> {
          const isEventTag = (tag: string): tag is Event.Tag<Events> => tag in group.events
          const decodePayload = <Tag extends Event.Tag<Events>>(tag: Tag, payload: Uint8Array) =>
            Schema.decodeUnknownEffect(group.events[tag].payloadMsgPack)(payload).pipe(
              Effect.updateServices((input) => ServiceMap.merge(services, input)),
              Effect.orDie
            ) as unknown as Effect.Effect<Event.PayloadWithTag<Events, Tag>>
          const writePayload = Effect.fnUntraced(function*<Tag extends Event.Tag<Events>>(
            timestamp: number,
            tag: Tag,
            payload: Event.PayloadWithTag<Events, Tag>
          ): Effect.fn.Return<void, never, Event.PayloadSchemaWithTag<Events, Tag>["EncodingServices"]> {
            const event = group.events[tag]
            const entry = new Entry({
              id: makeEntryIdUnsafe({ msecs: timestamp }),
              event: tag,
              payload: yield* Schema.encodeUnknownEffect(event.payloadMsgPack)(payload).pipe(
                Effect.orDie
              ) as any,
              primaryKey: event.primaryKey(payload)
            }, { disableChecks: true })
            yield* write(entry)
          })

          const byPrimaryKey = new Map<
            string,
            {
              readonly entries: Array<Entry>
              readonly taggedPayloads: Array<Event.TaggedPayload<Events>>
            }
          >()
          for (const entry of entries) {
            if (!isEventTag(entry.event)) {
              continue
            }
            const payload = yield* decodePayload(entry.event, entry.payload)
            const record = byPrimaryKey.get(entry.primaryKey)
            const taggedPayload = { _tag: entry.event, payload } as unknown as Event.TaggedPayload<Events>
            if (record) {
              record.entries.push(entry)
              record.taggedPayloads.push(taggedPayload)
            } else {
              byPrimaryKey.set(entry.primaryKey, {
                entries: [entry],
                taggedPayloads: [taggedPayload]
              })
            }
          }

          for (const [primaryKey, { entries, taggedPayloads }] of byPrimaryKey) {
            yield* Effect.orDie(
              effect({
                primaryKey,
                entries,
                events: taggedPayloads,
                write(tag, payload) {
                  return Effect.orDie(writePayload(entries[0].createdAtMillis, tag, payload))
                }
              }).pipe(
                Effect.updateServices((input) => ServiceMap.merge(services, input))
              )
            ) as any
          }
        })
      })
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

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeHandler: Effect.Effect<
  (socket: Socket.Socket) => Effect.Effect<void, Socket.SocketError>,
  never,
  EventLogServerUnencrypted
> = Effect.gen(function*() {
  const runtime = yield* EventLogServerUnencrypted
  const remoteId = yield* runtime.getId
  let chunkId = 0

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

      const write = Effect.fnUntraced(function*(response: Schema.Schema.Type<typeof ProtocolResponseUnencrypted>) {
        const data = yield* encodeResponseUnencrypted(response)
        if (response._tag !== "Changes" || data.byteLength <= constChunkSize) {
          return yield* writeRaw(data)
        }
        const id = chunkId++
        for (const part of ChunkedMessage.split(id, data)) {
          yield* writeRaw(yield* encodeResponseUnencrypted(part))
        }
      })

      const writeError = Effect.fnUntraced(function*(options: {
        readonly requestTag: "WriteEntries" | "RequestChanges"
        readonly id?: number | undefined
        readonly publicKey?: string | undefined
        readonly error: EventLogServerAuthError | EventLogServerStoreError
      }) {
        yield* Effect.orDie(write(
          new ErrorUnencrypted({
            requestTag: options.requestTag,
            id: options.id,
            publicKey: options.publicKey,
            code: toProtocolErrorCode(options.error),
            message: toProtocolErrorMessage(options.error)
          })
        ))
      })

      yield* Effect.forkChild(Effect.orDie(write(new Hello({ remoteId }))))

      const handleRequest = (
        request: Schema.Schema.Type<typeof ProtocolRequestUnencrypted>
      ): Effect.Effect<void> => {
        switch (request._tag) {
          case "Ping": {
            return Effect.orDie(write(new Pong({ id: request.id })))
          }
          case "WriteEntries": {
            return runtime.ingest({
              publicKey: request.publicKey,
              entries: request.entries
            }).pipe(
              Effect.flatMap((persisted) =>
                Effect.orDie(
                  write(
                    new Ack({
                      id: request.id,
                      sequenceNumbers: persisted.sequenceNumbers
                    })
                  )
                )
              ),
              Effect.catchTag("EventLogServerAuthError", (error) =>
                writeError({
                  requestTag: "WriteEntries",
                  id: request.id,
                  publicKey: request.publicKey,
                  error
                })),
              Effect.catchTag("EventLogServerStoreError", (error) =>
                writeError({
                  requestTag: "WriteEntries",
                  id: request.id,
                  publicKey: request.publicKey,
                  error
                }))
            )
          }
          case "RequestChanges": {
            return runtime.requestChanges(request.publicKey, request.startSequence).pipe(
              Effect.flatMap((changes) =>
                Queue.takeAll(changes).pipe(
                  Effect.flatMap((entries) => {
                    if (entries.length === 0) {
                      return Effect.void
                    }

                    return Effect.orDie(
                      write(
                        new ChangesUnencrypted({
                          publicKey: request.publicKey,
                          entries
                        })
                      )
                    )
                  }),
                  Effect.forever
                )
              ),
              Effect.catchTag("EventLogServerAuthError", (error) =>
                writeError({
                  requestTag: "RequestChanges",
                  publicKey: request.publicKey,
                  error
                })),
              Effect.catchTag("EventLogServerStoreError", (error) =>
                writeError({
                  requestTag: "RequestChanges",
                  publicKey: request.publicKey,
                  error
                })),
              Effect.orDie,
              Effect.scoped,
              FiberMap.run(subscriptions, request.publicKey),
              Effect.asVoid
            )
          }
          case "StopChanges": {
            return FiberMap.remove(subscriptions, request.publicKey)
          }
          case "ChunkedMessage": {
            const data = ChunkedMessage.join(chunks, request)
            if (!data) {
              return Effect.void
            }
            return Effect.flatMap(Effect.orDie(decodeRequestUnencrypted(data)), handleRequest)
          }
        }
      }

      yield* socket.run((data) => Effect.flatMap(Effect.orDie(decodeRequestUnencrypted(data)), handleRequest)).pipe(
        Effect.catchCause((cause) => Effect.logDebug(cause))
      )
    },
    Effect.scoped,
    Effect.annotateLogs({
      module: "EventLogServerUnencrypted"
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
  EventLogServerUnencrypted
> = Effect.gen(function*() {
  const handler = yield* makeHandler

  // @effect-diagnostics-next-line returnEffectInGen:off
  return Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const socket = yield* request.upgrade
    yield* handler(socket)
    return HttpServerResponse.empty()
  }).pipe(Effect.annotateLogs({
    module: "EventLogServerUnencrypted"
  }))
})
