/**
 * @since 4.0.0
 */
import * as Arr from "../../Array.ts"
import * as Cause from "../../Cause.ts"
import { Clock } from "../../Clock.ts"
import * as Data from "../../Data.ts"
import * as Effect from "../../Effect.ts"
import * as FiberMap from "../../FiberMap.ts"
import * as Layer from "../../Layer.ts"
import * as Option from "../../Option.ts"
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
import { Reactivity } from "../reactivity/Reactivity.ts"
import * as ReactivityLayer from "../reactivity/Reactivity.ts"
import type * as Socket from "../socket/Socket.ts"
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
import {
  Ack,
  Authenticated,
  ChangesUnencrypted,
  ChunkedMessage,
  decodeRequestUnencrypted,
  encodeResponseUnencrypted,
  Hello,
  Pong,
  ProtocolError,
  type ProtocolRequestUnencrypted,
  type ProtocolResponseUnencrypted
} from "./EventLogRemote.ts"
import * as EventLogSessionAuth from "./EventLogSessionAuth.ts"

/**
 * @since 4.0.0
 * @category runtime
 */
export class EventLogServerUnencrypted extends ServiceMap.Service<EventLogServerUnencrypted, {
  readonly getId: Effect.Effect<RemoteId>
  readonly authenticateSession: (options: {
    readonly publicKey: string
    readonly signingPublicKey: Uint8Array
  }) => Effect.Effect<boolean>
  readonly ingest: (options: {
    readonly publicKey: string
    readonly storeId: EventLog.StoreId
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<{
    readonly storeId: EventLog.StoreId
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }, EventLogServerAuthError | EventLogServerStoreError>
  readonly write: <Groups extends EventGroup.Any, Tag extends Event.Tag<EventGroup.Events<Groups>>>(options: {
    readonly schema: EventLog.EventLogSchema<Groups>
    readonly storeId: EventLog.StoreId
    readonly event: Tag
    readonly payload: Event.PayloadWithTag<EventGroup.Events<Groups>, Tag>
    readonly entryId?: EntryId | undefined
  }) => Effect.Effect<void, EventLogServerStoreError>
  readonly requestChanges: (
    publicKey: string,
    storeId: EventLog.StoreId,
    startSequence: number
  ) => Effect.Effect<
    Queue.Dequeue<RemoteEntry, Cause.Done>,
    EventLogServerAuthError | EventLogServerStoreError,
    Scope.Scope
  >
}>()("effect/eventlog/EventLogServerUnencrypted") {}

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
 * @category errors
 */
export class EventLogServerStoreError extends Data.TaggedError("EventLogServerStoreError")<{
  readonly reason: "NotFound" | "PersistenceFailure"
  readonly publicKey?: string | undefined
  readonly storeId?: EventLog.StoreId | undefined
  readonly message?: string | undefined
}> {}

/**
 * @since 4.0.0
 * @category errors
 */
export class EventLogServerAuthError extends Data.TaggedError("EventLogServerAuthError")<{
  readonly reason: "Unauthorized" | "Forbidden"
  readonly publicKey: string
  readonly storeId?: EventLog.StoreId | undefined
  readonly message?: string | undefined
}> {}

/**
 * @since 4.0.0
 * @category context
 */
export class EventLogServerAuth extends ServiceMap.Service<EventLogServerAuth, {
  readonly authorizeWrite: (options: {
    readonly publicKey: string
    readonly storeId: EventLog.StoreId
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<void, EventLogServerAuthError>
  readonly authorizeRead: (options: {
    readonly publicKey: string
    readonly storeId: EventLog.StoreId
  }) => Effect.Effect<void, EventLogServerAuthError>
  readonly authorizeIdentity: (options: {
    readonly publicKey: string
  }) => Effect.Effect<void, EventLogServerAuthError>
}>()("effect/eventlog/EventLogServerUnencrypted/EventLogServerAuth") {}

/**
 * @since 4.0.0
 * @category context
 */
export class StoreMapping extends ServiceMap.Service<StoreMapping, {
  readonly resolve: (
    options: {
      readonly publicKey: string
      readonly storeId: EventLog.StoreId
    }
  ) => Effect.Effect<EventLog.StoreId, EventLogServerStoreError>
  readonly hasStore: (options: {
    readonly publicKey: string
    readonly storeId: EventLog.StoreId
  }) => Effect.Effect<boolean, EventLogServerStoreError>
}>()("effect/eventlog/EventLogServerUnencrypted/StoreMapping") {}

const toStoreNotFoundError = (options: {
  readonly storeId: EventLog.StoreId
  readonly publicKey?: string | undefined
}) =>
  new EventLogServerStoreError({
    reason: "NotFound",
    publicKey: options.publicKey,
    storeId: options.storeId,
    message: options.publicKey === undefined
      ? `No provisioned store found for store id: ${options.storeId}`
      : `No provisioned store found for public key: ${options.publicKey} and store id: ${options.storeId}`
  })

/**
 * @since 4.0.0
 * @category store
 */
export const layerStoreMappingStatic = (options: {
  readonly storeId: EventLog.StoreId
}): Layer.Layer<StoreMapping> =>
  Layer.succeed(StoreMapping, {
    resolve(request) {
      if (request.storeId === options.storeId) {
        return Effect.succeed(options.storeId)
      }
      return Effect.fail(toStoreNotFoundError(request))
    },
    hasStore: (_) => Effect.succeed(true)
  })

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
    storeId: EventLog.StoreId,
    entries: ReadonlyArray<Entry>
  ) => Effect.Effect<{
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }>
  readonly entries: (
    storeId: EventLog.StoreId,
    startSequence: number
  ) => Effect.Effect<ReadonlyArray<RemoteEntry>>
  readonly changes: (
    storeId: EventLog.StoreId,
    startSequence: number
  ) => Effect.Effect<Queue.Dequeue<RemoteEntry, Cause.Done>, never, Scope.Scope>
  readonly withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}>()("effect/eventlog/EventLogServerUnencrypted/Storage") {}

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
  privateKey: Redacted.make(new Uint8Array(32)),
  signingPublicKey: new Uint8Array(32),
  signingPrivateKey: Redacted.make(new Uint8Array(32))
})

const makeServerWriteIdentityPublicKey = (storeId: EventLog.StoreId): string =>
  `effect-eventlog-server-write:${storeId}`

const makeStoreScopeKey = (options: {
  readonly publicKey: string
  readonly storeId: EventLog.StoreId
}): string => JSON.stringify([options.publicKey, options.storeId])

const entriesAfter = (journal: Array<RemoteEntry>, startSequence: number): ReadonlyArray<RemoteEntry> =>
  journal.filter((entry) => entry.remoteSequence > startSequence)

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
  readonly effect: (options: {
    readonly entries: ReadonlyArray<Entry>
    readonly write: (entry: Entry) => Effect.Effect<void>
  }) => Effect.Effect<void>
}

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
}) {
  if (options.compactors.size === 0 || options.remoteEntries.length === 0) {
    return options.remoteEntries
  }

  const compactedRemoteEntries: Array<RemoteEntry> = []
  let index = 0

  while (index < options.remoteEntries.length) {
    const remoteEntry = options.remoteEntries[index]!
    const compactor = options.compactors.get(remoteEntry.entry.event)
    if (compactor === undefined) {
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
      if (nextCompactor !== compactor) {
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
  const sessionAuthBindings = new Map<string, Uint8Array>()
  const remoteId = makeRemoteIdUnsafe()

  const ensureKnownIds = (storeId: EventLog.StoreId): Map<string, number> => {
    let storeKnownIds = knownIds.get(storeId)
    if (storeKnownIds) return storeKnownIds
    storeKnownIds = new Map()
    knownIds.set(storeId, storeKnownIds)
    return storeKnownIds
  }

  const ensureJournal = (storeId: EventLog.StoreId): Array<RemoteEntry> => {
    let journal = journals.get(storeId)
    if (journal) return journal
    journal = []
    journals.set(storeId, journal)
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

  const write = Effect.fnUntraced(function*(storeId: EventLog.StoreId, entries: ReadonlyArray<Entry>) {
    const pubsub = yield* RcMap.get(pubsubs, storeId)
    const sequenceNumbers: Array<number> = []
    const committed: Array<RemoteEntry> = []
    const storeKnownIds = ensureKnownIds(storeId)
    const journal = ensureJournal(storeId)
    let lastSequenceNumber = Arr.last(journal).pipe(
      Option.map((entry) => entry.remoteSequence),
      Option.getOrElse(() => 0)
    )

    for (const entry of entries) {
      const existingCommitted = storeKnownIds.get(entry.idString)
      if (existingCommitted !== undefined) {
        sequenceNumbers.push(existingCommitted)
        continue
      }

      const remoteEntry = new RemoteEntry({
        remoteSequence: ++lastSequenceNumber,
        entry
      }, { disableChecks: true })

      sequenceNumbers.push(remoteEntry.remoteSequence)
      committed.push(remoteEntry)
      journal.push(remoteEntry)
      storeKnownIds.set(entry.idString, remoteEntry.remoteSequence)
    }

    yield* PubSub.publishAll(pubsub, committed)

    return {
      sequenceNumbers,
      committed
    }
  }, Effect.scoped)

  const transactionSemaphore = yield* Semaphore.make(1)

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
    write,
    entries: (storeId, startSequence) => Effect.sync(() => entriesAfter(ensureJournal(storeId), startSequence)),
    changes: Effect.fnUntraced(function*(storeId, startSequence) {
      const queue = yield* Queue.make<RemoteEntry>()
      const pubsub = yield* RcMap.get(pubsubs, storeId)
      const subscription = yield* PubSub.subscribe(pubsub)

      const backlog = entriesAfter(ensureJournal(storeId), startSequence)
      const replayedUpTo = backlog.length > 0 ? backlog[backlog.length - 1].remoteSequence : startSequence

      yield* Queue.offerAll(queue, backlog)
      yield* Effect.yieldNow.pipe(
        Effect.andThen(
          PubSub.takeAll(subscription).pipe(
            Effect.flatMap((chunk) =>
              Queue.offerAll(queue, chunk.filter((entry) => entry.remoteSequence > replayedUpTo))
            ),
            Effect.forever
          )
        ),
        Effect.forkScoped
      )

      yield* Effect.addFinalizer(() => Queue.shutdown(queue))
      return Queue.asDequeue(queue)
    }),
    withTransaction: transactionSemaphore.withPermits(1)
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
  const storage = yield* Storage
  const mapping = yield* StoreMapping
  const auth = yield* EventLogServerAuth
  const registry = yield* EventLog.Registry
  const reactivity = yield* Reactivity
  const trustedSessionAuthBindings = new Map<string, Uint8Array>()
  const persistedSessionAuthBindings = yield* storage.loadSessionAuthBindings

  for (const [publicKey, signingPublicKey] of persistedSessionAuthBindings) {
    trustedSessionAuthBindings.set(publicKey, copyUint8Array(signingPublicKey))
  }

  const replayFromRemote = Effect.fnUntraced(
    function*(options: {
      readonly publicKey: string
      readonly storeId: EventLog.StoreId
      readonly entry: Entry
      readonly conflicts: ReadonlyArray<Entry>
    }): Effect.fn.Return<void> {
      const handler = registry.handlers.get(options.entry.event)
      if (handler === undefined) {
        return yield* Effect.logDebug(`Event handler not found for: "${options.entry.event}"`)
      }

      const decodePayload = Schema.decodeUnknownEffect(handler.event.payloadMsgPack)
      const decodedConflicts: Array<{ readonly entry: Entry; readonly payload: unknown }> = []

      for (const conflict of options.conflicts) {
        decodedConflicts.push({
          entry: conflict,
          payload: yield* decodePayload(conflict.payload).pipe(
            Effect.updateServices((input) => ServiceMap.merge(handler.services, input))
          ) as any
        })
      }

      yield* decodePayload(options.entry.payload).pipe(
        Effect.flatMap((payload) =>
          handler.handler({
            storeId: options.storeId,
            payload,
            entry: options.entry,
            conflicts: decodedConflicts
          })
        ),
        Effect.provideService(EventLog.Identity, makeClientIdentity(options.publicKey)),
        Effect.updateServices((input) => ServiceMap.merge(handler.services, input)),
        Effect.asVoid
      ) as any
    },
    (effect, options) =>
      Effect.catchCause(effect, (cause) =>
        Effect.fail(
          new EventLogServerStoreError({
            reason: "PersistenceFailure",
            publicKey: options.publicKey,
            storeId: options.storeId,
            message: Cause.pretty(cause)
          })
        )),
    (effect, options) =>
      Effect.annotateLogs(effect, {
        service: "EventLogServerUnencrypted",
        effect: "writeFromRemote",
        entryId: options.entry.idString
      })
  )

  const invalidateCommittedEntries = Effect.fnUntraced(function*(committed: ReadonlyArray<RemoteEntry>) {
    for (const remoteEntry of committed) {
      const keys = registry.reactivityKeys[remoteEntry.entry.event]
      if (keys === undefined) {
        continue
      }

      for (const key of keys) {
        yield* Effect.sync(() =>
          reactivity.invalidateUnsafe({
            [key]: [remoteEntry.entry.primaryKey]
          })
        )
      }
    }
  })

  const processBeforePersist = (options: {
    readonly storeId: EventLog.StoreId
    readonly publicKey: string
    readonly entries: ReadonlyArray<Entry>
  }) =>
    storage.withTransaction(
      Effect.gen(function*() {
        const committedHistory = yield* storage.entries(options.storeId, 0)
        const committedSequenceById = new Map<string, number>()
        const processedEntriesByCreatedAt: Array<Entry> = []

        for (const remoteEntry of committedHistory) {
          committedSequenceById.set(remoteEntry.entry.idString, remoteEntry.remoteSequence)
          insertEntryByCreatedAt(processedEntriesByCreatedAt, remoteEntry.entry)
        }

        const acceptedEntries: Array<Entry> = []
        const acceptedEntryIds = new Set<string>()
        for (const entry of options.entries) {
          if (committedSequenceById.has(entry.idString) || acceptedEntryIds.has(entry.idString)) {
            continue
          }
          acceptedEntryIds.add(entry.idString)
          acceptedEntries.push(entry)
        }

        for (const entry of acceptedEntries) {
          const conflicts = toConflicts(processedEntriesByCreatedAt, entry)
          yield* replayFromRemote({
            publicKey: options.publicKey,
            storeId: options.storeId,
            entry,
            conflicts
          })
          yield* Effect.sync(() => {
            insertEntryByCreatedAt(processedEntriesByCreatedAt, entry)
          })
        }

        const persisted = acceptedEntries.length === 0
          ? {
            sequenceNumbers: [] as ReadonlyArray<number>,
            committed: [] as ReadonlyArray<RemoteEntry>
          }
          : yield* storage.write(options.storeId, acceptedEntries)

        const acceptedSequenceById = new Map<string, number>()
        for (let index = 0; index < acceptedEntries.length; index++) {
          acceptedSequenceById.set(acceptedEntries[index]!.idString, persisted.sequenceNumbers[index]!)
        }

        return {
          sequenceNumbers: options.entries.map((entry) => {
            const committedSequence = committedSequenceById.get(entry.idString)
            if (committedSequence !== undefined) {
              return committedSequence
            }

            const acceptedSequence = acceptedSequenceById.get(entry.idString)
            if (acceptedSequence !== undefined) {
              return acceptedSequence
            }

            throw new Error(`Missing sequence number for entry id: ${entry.idString}`)
          }),
          committed: persisted.committed
        }
      })
    ).pipe(
      Effect.tap(({ committed }) =>
        invalidateCommittedEntries(committed).pipe(
          Effect.ignore({
            log: "Error",
            message: "Post-commit Reactivity invalidation failed"
          })
        )
      )
    )

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

  const ensureStoreExists = Effect.fnUntraced(function*(options: {
    readonly publicKey: string
    readonly storeId: EventLog.StoreId
  }) {
    const provisioned = yield* mapping.hasStore(options)
    if (provisioned) {
      return
    }

    return yield* toStoreNotFoundError(options)
  })

  const ensureTrustedSessionAuthBinding = Effect.fnUntraced(function*(options: {
    readonly publicKey: string
    readonly signingPublicKey: Uint8Array
  }): Effect.fn.Return<boolean, EventLogServerAuthError | EventLogServerStoreError> {
    const trustedSigningPublicKey = trustedSessionAuthBindings.get(options.publicKey)
    if (trustedSigningPublicKey !== undefined) {
      return equalsUint8Array(trustedSigningPublicKey, options.signingPublicKey)
    }

    yield* auth.authorizeIdentity({ publicKey: options.publicKey })

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

  const serverWrite = Effect.fnUntraced(function*(options: {
    readonly schema: EventLog.EventLogSchema<any>
    readonly storeId: EventLog.StoreId
    readonly event: string
    readonly payload: unknown
    readonly entryId?: EntryId | undefined
  }) {
    const publicKey = makeServerWriteIdentityPublicKey(options.storeId)
    yield* ensureStoreExists({
      publicKey,
      storeId: options.storeId
    })

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

    yield* processBeforePersist({
      storeId: options.storeId,
      publicKey,
      entries: [entry]
    })
  })

  return EventLogServerUnencrypted.of({
    getId: storage.getId,
    authenticateSession: (options) =>
      ensureTrustedSessionAuthBinding(options).pipe(
        Effect.catchTag("EventLogServerAuthError", () => Effect.succeed(false)),
        Effect.catchTag("EventLogServerStoreError", () => Effect.succeed(false))
      ),
    ingest: Effect.fnUntraced(function*({ publicKey, storeId, entries }) {
      const resolvedStoreId = yield* mapping.resolve({
        publicKey,
        storeId
      })
      yield* auth.authorizeWrite({
        publicKey,
        storeId: resolvedStoreId,
        entries
      })

      const persisted = yield* processBeforePersist({
        storeId: resolvedStoreId,
        publicKey,
        entries
      })

      return {
        storeId: resolvedStoreId,
        sequenceNumbers: persisted.sequenceNumbers,
        committed: persisted.committed
      }
    }),
    write: serverWrite as EventLogServerUnencrypted["Service"]["write"],
    requestChanges: Effect.fnUntraced(function*(publicKey: string, storeId: EventLog.StoreId, startSequence: number) {
      const resolvedStoreId = yield* mapping.resolve({
        publicKey,
        storeId
      })
      yield* auth.authorizeRead({
        publicKey,
        storeId: resolvedStoreId
      })

      const queue = yield* Queue.make<RemoteEntry>()

      yield* Effect.gen(function*() {
        let sequence = startSequence
        const committedChanges = yield* storage.changes(resolvedStoreId, sequence)

        while (true) {
          const entries = yield* Queue.takeAll(committedChanges)
          let toOffer = Arr.empty<RemoteEntry>()

          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]
            if (entry.remoteSequence <= sequence) {
              continue
            }
            toOffer.push(entry)
            sequence = entry.remoteSequence
          }

          yield* Queue.offerAll(
            queue,
            toOffer.length > 1 ?
              yield* compactBacklog({
                remoteEntries: toOffer,
                compactors: registry.compactors
              }) :
              toOffer
          )
        }
      }).pipe(
        Effect.forkScoped
      )

      yield* Effect.addFinalizer(() => Queue.shutdown(queue))
      return Queue.asDequeue(queue)
    })
  })
})

/**
 * @since 4.0.0
 * @category layers
 */
export const layerServer: Layer.Layer<
  EventLogServerUnencrypted | EventLog.Registry,
  never,
  Storage | StoreMapping | EventLogServerAuth
> = Layer.effect(EventLogServerUnencrypted, make).pipe(
  Layer.provide(ReactivityLayer.layer),
  Layer.provideMerge(EventLog.layerRegistry)
)

/**
 * @since 4.0.0
 * @category layers
 */
export const layer = <Groups extends EventGroup.Any>(
  _schema: EventLog.EventLogSchema<Groups>
): Layer.Layer<
  never,
  never,
  EventGroup.ToService<Groups> | EventLogServerUnencrypted
> => Layer.empty as any

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeHandler: Effect.Effect<
  (socket: Socket.Socket) => Effect.Effect<void, Socket.SocketError>,
  never,
  EventLogServerUnencrypted
> = Effect.gen(function*() {
  const clock = yield* Clock
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
      const sessionChallenge = yield* EventLogSessionAuth.makeSessionAuthChallenge.pipe(Effect.orDie)
      const sessionChallengeIssuedAt = clock.currentTimeMillisUnsafe()
      let sessionChallengeUsed = false
      let authenticatedPublicKey: string | undefined

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

      const writeProtocolError = Effect.fnUntraced(function*(options: {
        readonly requestTag: "Authenticate" | "WriteEntries" | "RequestChanges" | "StopChanges"
        readonly id?: number | undefined
        readonly publicKey?: string | undefined
        readonly storeId?: EventLog.StoreId | undefined
        readonly code: ProtocolErrorCode
        readonly message: string
      }) {
        yield* Effect.orDie(write(
          new ProtocolError({
            requestTag: options.requestTag,
            id: options.id,
            publicKey: options.publicKey,
            storeId: options.storeId,
            code: options.code,
            message: options.message
          })
        ))
      })

      const writeError = Effect.fnUntraced(function*(options: {
        readonly requestTag: "WriteEntries" | "RequestChanges"
        readonly id?: number | undefined
        readonly publicKey?: string | undefined
        readonly storeId?: EventLog.StoreId | undefined
        readonly error: EventLogServerAuthError | EventLogServerStoreError
      }) {
        yield* writeProtocolError({
          requestTag: options.requestTag,
          id: options.id,
          publicKey: options.publicKey,
          storeId: options.storeId ?? options.error.storeId,
          code: toProtocolErrorCode(options.error),
          message: toProtocolErrorMessage(options.error)
        })
      })

      const writeForbidden = (options: {
        readonly requestTag: "Authenticate" | "WriteEntries" | "RequestChanges" | "StopChanges"
        readonly id?: number | undefined
        readonly publicKey?: string | undefined
        readonly storeId?: EventLog.StoreId | undefined
      }) =>
        writeProtocolError({
          requestTag: options.requestTag,
          id: options.id,
          publicKey: options.publicKey,
          storeId: options.storeId,
          code: "Forbidden",
          message: "Forbidden request"
        })

      const handleAuthenticate = Effect.fnUntraced(
        function*(
          request: Extract<Schema.Schema.Type<typeof ProtocolRequestUnencrypted>, { readonly _tag: "Authenticate" }>
        ) {
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

          const trusted = yield* runtime.authenticateSession({
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

      const handleRequest = (
        request: Schema.Schema.Type<typeof ProtocolRequestUnencrypted>
      ): Effect.Effect<void> => {
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
                publicKey: request.publicKey,
                storeId: request.storeId
              })
            }

            return runtime.ingest({
              publicKey: request.publicKey,
              storeId: request.storeId,
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
                  storeId: request.storeId,
                  error
                })),
              Effect.catchTag("EventLogServerStoreError", (error) =>
                writeError({
                  requestTag: "WriteEntries",
                  id: request.id,
                  publicKey: request.publicKey,
                  storeId: request.storeId,
                  error
                }))
            )
          }
          case "RequestChanges": {
            if (authenticatedPublicKey !== request.publicKey) {
              return writeForbidden({
                requestTag: "RequestChanges",
                publicKey: request.publicKey,
                storeId: request.storeId
              })
            }

            const subscriptionKey = makeStoreScopeKey({
              publicKey: request.publicKey,
              storeId: request.storeId
            })

            return runtime.requestChanges(request.publicKey, request.storeId, request.startSequence).pipe(
              Effect.flatMap((changes) =>
                Queue.takeAll(changes).pipe(
                  Effect.flatMap((entries) => {
                    if (entries.length === 0) {
                      return Effect.void
                    }

                    return Effect.orDie(
                      write(
                        new ChangesUnencrypted({
                          storeId: request.storeId,
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
                  storeId: request.storeId,
                  error
                })),
              Effect.catchTag("EventLogServerStoreError", (error) =>
                writeError({
                  requestTag: "RequestChanges",
                  publicKey: request.publicKey,
                  storeId: request.storeId,
                  error
                })),
              Effect.orDie,
              Effect.scoped,
              FiberMap.run(subscriptions, subscriptionKey),
              Effect.asVoid
            )
          }
          case "StopChanges": {
            if (authenticatedPublicKey !== request.publicKey) {
              return writeForbidden({
                requestTag: "StopChanges",
                publicKey: request.publicKey,
                storeId: request.storeId
              })
            }

            return FiberMap.remove(
              subscriptions,
              makeStoreScopeKey({
                publicKey: request.publicKey,
                storeId: request.storeId
              })
            )
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
