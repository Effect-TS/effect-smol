/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Arr from "../../collections/Array.ts"
import * as HashRing from "../../collections/HashRing.ts"
import * as Iterable from "../../collections/Iterable.ts"
import * as MutableHashMap from "../../collections/MutableHashMap.ts"
import * as MutableHashSet from "../../collections/MutableHashSet.ts"
import * as Filter from "../../data/Filter.ts"
import * as Option from "../../data/Option.ts"
import * as Effect from "../../Effect.ts"
import * as Fiber from "../../Fiber.ts"
import * as FiberMap from "../../FiberMap.ts"
import * as FiberSet from "../../FiberSet.ts"
import { constant } from "../../Function.ts"
import * as Equal from "../../interfaces/Equal.ts"
import * as Layer from "../../Layer.ts"
import * as MutableRef from "../../MutableRef.ts"
import * as PubSub from "../../PubSub.ts"
import { CurrentLogAnnotations } from "../../References.ts"
import * as Schedule from "../../Schedule.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../stream/Stream.ts"
import type { DurationInput } from "../../time/Duration.ts"
import type * as Rpc from "../rpc/Rpc.ts"
import * as RpcClient from "../rpc/RpcClient.ts"
import { type FromServer, RequestId } from "../rpc/RpcMessage.ts"
import type { MailboxFull, PersistenceError } from "./ClusterError.ts"
import { AlreadyProcessingMessage, EntityNotAssignedToRunner, EntityNotManagedByRunner } from "./ClusterError.ts"
import { Persisted, Uninterruptible } from "./ClusterSchema.ts"
import * as ClusterSchema from "./ClusterSchema.ts"
import type { CurrentAddress, CurrentRunnerAddress, Entity, HandlersFrom } from "./Entity.ts"
import type { EntityAddress } from "./EntityAddress.ts"
import { make as makeEntityAddress } from "./EntityAddress.ts"
import type { EntityId } from "./EntityId.ts"
import { make as makeEntityId } from "./EntityId.ts"
import * as Envelope from "./Envelope.ts"
import * as EntityManager from "./internal/entityManager.ts"
import { EntityReaper } from "./internal/entityReaper.ts"
import { hashString } from "./internal/hash.ts"
import { internalInterruptors } from "./internal/interruptors.ts"
import { ResourceMap } from "./internal/resourceMap.ts"
import * as Message from "./Message.ts"
import * as MessageStorage from "./MessageStorage.ts"
import * as Reply from "./Reply.ts"
import { Runner } from "./Runner.ts"
import type { RunnerAddress } from "./RunnerAddress.ts"
import { Runners } from "./Runners.ts"
import { RunnerStorage } from "./RunnerStorage.ts"
import type { ShardId } from "./ShardId.ts"
import { make as makeShardId } from "./ShardId.ts"
import { ShardingConfig } from "./ShardingConfig.ts"
import { EntityRegistered, type ShardingRegistrationEvent, SingletonRegistered } from "./ShardingRegistrationEvent.ts"
import { SingletonAddress } from "./SingletonAddress.ts"
import * as Snowflake from "./Snowflake.ts"

/**
 * @since 4.0.0
 * @category models
 */
export class Sharding extends ServiceMap.Key<Sharding, {
  /**
   * Returns a stream of events that occur when the runner registers entities or
   * singletons.
   */
  readonly getRegistrationEvents: Stream.Stream<ShardingRegistrationEvent>

  /**
   * Returns the `ShardId` of the shard to which the entity at the specified
   * `address` is assigned.
   */
  readonly getShardId: (entityId: EntityId, group: string) => ShardId

  /**
   * Returns `true` if sharding is shutting down, `false` otherwise.
   */
  readonly isShutdown: Effect.Effect<boolean>

  /**
   * Constructs a `RpcClient` which can be used to send messages to the
   * specified `Entity`.
   */
  readonly makeClient: <Type extends string, Rpcs extends Rpc.Any>(
    entity: Entity<Type, Rpcs>
  ) => Effect.Effect<
    (
      entityId: string
    ) => RpcClient.RpcClient.From<
      Rpcs,
      MailboxFull | AlreadyProcessingMessage | PersistenceError | EntityNotManagedByRunner
    >
  >

  /**
   * Registers a new entity with the runner.
   */
  readonly registerEntity: <Type extends string, Rpcs extends Rpc.Any, Handlers extends HandlersFrom<Rpcs>, RX>(
    entity: Entity<Type, Rpcs>,
    handlers: Effect.Effect<Handlers, never, RX>,
    options?: {
      readonly maxIdleTime?: DurationInput | undefined
      readonly concurrency?: number | "unbounded" | undefined
      readonly mailboxCapacity?: number | "unbounded" | undefined
      readonly disableFatalDefects?: boolean | undefined
      readonly defectRetryPolicy?: Schedule.Schedule<any, unknown> | undefined
      readonly spanAttributes?: Record<string, string> | undefined
    }
  ) => Effect.Effect<
    void,
    never,
    Rpc.ServicesServer<Rpcs> | Rpc.Middleware<Rpcs> | Exclude<RX, Scope.Scope | CurrentAddress | CurrentRunnerAddress>
  >

  /**
   * Registers a new singleton with the runner.
   */
  readonly registerSingleton: <E, R>(
    name: string,
    run: Effect.Effect<void, E, R>,
    options?: {
      readonly shardGroup?: string | undefined
    }
  ) => Effect.Effect<void, never, Exclude<R, Scope.Scope>>

  /**
   * Sends a message to the specified entity.
   */
  readonly send: (message: Message.Incoming<any>) => Effect.Effect<
    void,
    EntityNotManagedByRunner | EntityNotAssignedToRunner | MailboxFull | AlreadyProcessingMessage
  >

  /**
   * Sends an outgoing message
   */
  readonly sendOutgoing: (
    message: Message.Outgoing<any>,
    discard: boolean
  ) => Effect.Effect<
    void,
    EntityNotManagedByRunner | MailboxFull | AlreadyProcessingMessage | PersistenceError
  >

  /**
   * Notify sharding that a message has been persisted to storage.
   */
  readonly notify: (message: Message.Incoming<any>) => Effect.Effect<
    void,
    EntityNotManagedByRunner | EntityNotAssignedToRunner | AlreadyProcessingMessage
  >

  /**
   * Reset the state of a message
   */
  readonly reset: (requestId: Snowflake.Snowflake) => Effect.Effect<boolean>

  /**
   * Trigger a storage read, which will read all unprocessed messages.
   */
  readonly pollStorage: Effect.Effect<void>

  /**
   * Retrieves the active entity count for the current runner.
   */
  readonly activeEntityCount: Effect.Effect<number>
}>()("effect/cluster/Sharding") {}

// -----------------------------------------------------------------------------
// Implementation
// -----------------------------------------------------------------------------

interface EntityManagerState {
  readonly entity: Entity<any, any>
  readonly scope: Scope.Closeable
  readonly manager: EntityManager.EntityManager
}

const make = Effect.gen(function*() {
  const config = yield* ShardingConfig

  const runners = yield* Runners
  const snowflakeGen = yield* Snowflake.Generator
  const shardingScope = yield* Effect.scope
  const isShutdown = MutableRef.make(false)

  const storage = yield* MessageStorage.MessageStorage
  const storageEnabled = storage !== MessageStorage.noop
  const runnerStorage = yield* RunnerStorage

  const entityManagers = new Map<string, EntityManagerState>()

  const shardAssignments = MutableHashMap.empty<ShardId, RunnerAddress>()
  const selfShards = MutableHashSet.empty<ShardId>()

  // the active shards are the ones that we have acquired the lock for
  const acquiredShards = MutableHashSet.empty<ShardId>()
  const activeShardsLatch = yield* Effect.makeLatch(false)

  const events = yield* PubSub.unbounded<ShardingRegistrationEvent>()
  const getRegistrationEvents: Stream.Stream<ShardingRegistrationEvent> = Stream.fromPubSub(events)

  const isLocalRunner = (address: RunnerAddress) => config.runnerAddress && Equal.equals(address, config.runnerAddress)

  function getShardId(entityId: EntityId, group: string): ShardId {
    const id = Math.abs(hashString(entityId) % config.shardsPerGroup) + 1
    return makeShardId(group, id)
  }

  function isEntityOnLocalShards(address: EntityAddress): boolean {
    return MutableHashSet.has(acquiredShards, address.shardId)
  }

  // --- Shard acquisition ---

  if (config.runnerAddress) {
    const selfAddress = config.runnerAddress
    yield* Scope.addFinalizerExit(shardingScope, () => {
      // the locks expire over time, so if this fails we ignore it
      return Effect.ignore(runnerStorage.releaseAll(selfAddress))
    })

    const releasingShards = MutableHashSet.empty<ShardId>()
    yield* Effect.gen(function*() {
      activeShardsLatch.openUnsafe()

      while (true) {
        yield* activeShardsLatch.await
        activeShardsLatch.closeUnsafe()

        // if a shard is no longer assigned to this runner, we release it
        for (const shardId of acquiredShards) {
          if (MutableHashSet.has(selfShards, shardId)) continue
          MutableHashSet.remove(acquiredShards, shardId)
          MutableHashSet.add(releasingShards, shardId)
        }
        // if a shard has been assigned to this runner, we acquire it
        const unacquiredShards = MutableHashSet.empty<ShardId>()
        for (const shardId of selfShards) {
          if (MutableHashSet.has(acquiredShards, shardId) || MutableHashSet.has(releasingShards, shardId)) continue
          MutableHashSet.add(unacquiredShards, shardId)
        }

        if (MutableHashSet.size(releasingShards) > 0) {
          yield* Effect.forkIn(syncSingletons, shardingScope)
          yield* releaseShards
        }

        if (MutableHashSet.size(unacquiredShards) === 0) {
          continue
        }

        const acquired = yield* runnerStorage.acquire(selfAddress, unacquiredShards)
        yield* Effect.ignore(storage.resetShards(acquired))
        for (const shardId of acquired) {
          MutableHashSet.add(acquiredShards, shardId)
        }
        if (acquired.length > 0) {
          yield* storageReadLatch.open
          yield* Effect.forkIn(syncSingletons, shardingScope)
        }
        yield* Effect.sleep(1000)
        activeShardsLatch.openUnsafe()
      }
    }).pipe(
      Effect.catchCause((cause) => Effect.logWarning("Could not acquire/release shards", cause)),
      Effect.repeat(Schedule.spaced(config.entityMessagePollInterval)),
      Effect.annotateLogs({
        package: "@effect/cluster",
        module: "Sharding",
        fiber: "Shard acquisition loop",
        runner: selfAddress
      }),
      Effect.forkIn(shardingScope)
    )

    // refresh the shard locks every 4s
    yield* Effect.suspend(() =>
      runnerStorage.refresh(selfAddress, [
        ...acquiredShards,
        ...releasingShards
      ])
    ).pipe(
      Effect.flatMap((acquired) => {
        for (const shardId of acquiredShards) {
          if (!acquired.includes(shardId)) {
            MutableHashSet.remove(acquiredShards, shardId)
            MutableHashSet.add(releasingShards, shardId)
          }
        }
        return MutableHashSet.size(releasingShards) > 0 ?
          Effect.andThen(
            Effect.forkIn(syncSingletons, shardingScope),
            releaseShards
          ) :
          Effect.void
      }),
      Effect.retry({
        times: 5,
        schedule: Schedule.spaced(50)
      }),
      Effect.catchCause((cause) =>
        Effect.logError("Could not refresh shard locks", cause).pipe(
          Effect.andThen(clearSelfShards)
        )
      ),
      Effect.repeat(Schedule.fixed("4 seconds")),
      Effect.forkIn(shardingScope)
    )

    const releaseShardsLock = Effect.makeSemaphoreUnsafe(1).withPermits(1)
    const releaseShards = releaseShardsLock(
      Effect.suspend(() =>
        Effect.forEach(
          releasingShards,
          (shardId) =>
            Effect.forEach(
              entityManagers.values(),
              (state) => state.manager.interruptShard(shardId),
              { concurrency: "unbounded", discard: true }
            ).pipe(
              Effect.andThen(runnerStorage.release(selfAddress, shardId)),
              Effect.annotateLogs({ runner: selfAddress }),
              Effect.andThen(() => {
                MutableHashSet.remove(releasingShards, shardId)
              })
            ),
          { concurrency: "unbounded", discard: true }
        )
      ).pipe(Effect.andThen(activeShardsLatch.open))
    )

    // open the shard latch every poll interval
    yield* activeShardsLatch.open.pipe(
      Effect.delay(config.entityMessagePollInterval),
      Effect.forever,
      Effect.forkIn(shardingScope)
    )
  }

  const clearSelfShards = Effect.sync(() => {
    MutableHashSet.clear(selfShards)
    activeShardsLatch.openUnsafe()
  })

  // --- Singletons ---

  const singletons = new Map<ShardId, MutableHashMap.MutableHashMap<SingletonAddress, Effect.Effect<void>>>()
  const singletonFibers = yield* FiberMap.make<SingletonAddress>()
  const withSingletonLock = Effect.makeSemaphoreUnsafe(1).withPermits(1)

  const registerSingleton: Sharding["Service"]["registerSingleton"] = Effect.fnUntraced(
    function*(name, run, options) {
      const shardGroup = options?.shardGroup ?? "default"
      const address = new SingletonAddress({
        shardId: getShardId(makeEntityId(name), shardGroup),
        name
      })

      let map = singletons.get(address.shardId)
      if (!map) {
        map = MutableHashMap.empty()
        singletons.set(address.shardId, map)
      }
      if (MutableHashMap.has(map, address)) {
        return yield* Effect.die(`Singleton '${name}' is already registered`)
      }

      const services = yield* Effect.services<never>()
      const wrappedRun = run.pipe(
        Effect.provideService(CurrentLogAnnotations, {}),
        Effect.andThen(Effect.never),
        Effect.scoped,
        Effect.provideServices(services),
        Effect.orDie
      ) as Effect.Effect<never>
      MutableHashMap.set(map, address, wrappedRun)

      yield* PubSub.publish(events, SingletonRegistered({ address }))

      // start if we are on the right shard
      if (MutableHashSet.has(acquiredShards, address.shardId)) {
        yield* Effect.logDebug("Starting singleton", address)
        yield* FiberMap.run(singletonFibers, address, wrappedRun)
      }
    },
    withSingletonLock
  )

  const syncSingletons = withSingletonLock(Effect.gen(function*() {
    for (const [shardId, map] of singletons) {
      for (const [address, run] of map) {
        const running = FiberMap.hasUnsafe(singletonFibers, address)
        const shouldBeRunning = MutableHashSet.has(acquiredShards, shardId)
        if (running && !shouldBeRunning) {
          yield* Effect.logDebug("Stopping singleton", address)
          internalInterruptors.add(Fiber.getCurrent()!.id)
          yield* FiberMap.remove(singletonFibers, address)
        } else if (!running && shouldBeRunning) {
          yield* Effect.logDebug("Starting singleton", address)
          yield* FiberMap.run(singletonFibers, address, run)
        }
      }
    }
  }))

  // --- Storage inbox ---

  const storageReadLatch = yield* Effect.makeLatch(true)
  const openStorageReadLatch = constant(Effect.sync(() => {
    storageReadLatch.openUnsafe()
  }))

  const storageReadLock = Effect.makeSemaphoreUnsafe(1)
  const withStorageReadLock = storageReadLock.withPermits(1)

  let storageAlreadyProcessed = (_message: Message.IncomingRequest<any>) => true

  // keep track of the last sent request ids to avoid duplicates
  // we only keep the last 30 sets to avoid memory leaks
  const sentRequestIds = new Set<Snowflake.Snowflake>()
  const sentRequestIdSets = new Set<Set<Snowflake.Snowflake>>()

  if (storageEnabled && config.runnerAddress) {
    const selfAddress = config.runnerAddress

    yield* Effect.gen(function*() {
      yield* Effect.logDebug("Starting")
      yield* Effect.addFinalizer(() => Effect.logDebug("Shutting down"))

      sentRequestIds.clear()
      sentRequestIdSets.clear()

      storageAlreadyProcessed = (message: Message.IncomingRequest<any>) => {
        if (!sentRequestIds.has(message.envelope.requestId)) {
          return false
        }
        const state = entityManagers.get(message.envelope.address.entityType)
        if (!state) return true
        return !state.manager.isProcessingFor(message, { excludeReplies: true })
      }

      while (true) {
        // wait for the next poll interval, or if we get notified of a change
        yield* storageReadLatch.await

        // if we get notified of a change, ensure we start a read immediately
        // next iteration
        storageReadLatch.closeUnsafe()

        // the lock is used to ensure resuming entities have a garantee that no
        // more items are added to the unprocessed set while the semaphore is
        // acquired.
        yield* storageReadLock.take(1)

        const messages = yield* storage.unprocessedMessages(acquiredShards)
        const currentSentRequestIds = new Set<Snowflake.Snowflake>()
        sentRequestIdSets.add(currentSentRequestIds)

        const send = Effect.catchCause(
          Effect.suspend(() => {
            const message = messages[index]
            if (message._tag === "IncomingRequest") {
              if (sentRequestIds.has(message.envelope.requestId)) {
                return Effect.void
              }
              sentRequestIds.add(message.envelope.requestId)
              currentSentRequestIds.add(message.envelope.requestId)
            }
            const address = message.envelope.address
            if (!MutableHashSet.has(acquiredShards, address.shardId)) {
              return Effect.void
            }
            const state = entityManagers.get(address.entityType)
            if (!state) {
              if (message._tag === "IncomingRequest") {
                return Effect.orDie(message.respond(Reply.ReplyWithContext.fromDefect({
                  id: snowflakeGen.nextUnsafe(),
                  requestId: message.envelope.requestId,
                  defect: new EntityNotManagedByRunner({ address })
                })))
              }
              return Effect.void
            }

            const isProcessing = state.manager.isProcessingFor(message)

            // If the message might affect a currently processing request, we
            // send it to the entity manager to be processed.
            if (message._tag === "IncomingEnvelope" && isProcessing) {
              return state.manager.send(message)
            } else if (isProcessing) {
              return Effect.void
            }

            // If the entity was resuming in another fiber, we add the message
            // id to the unprocessed set.
            const resumptionState = MutableHashMap.get(entityResumptionState, address)
            if (Option.isSome(resumptionState)) {
              resumptionState.value.unprocessed.add(message.envelope.requestId)
              if (message.envelope._tag === "Interrupt") {
                resumptionState.value.interrupts.set(message.envelope.requestId, message as Message.IncomingEnvelope)
              }
              return Effect.void
            }
            return state.manager.send(message)
          }),
          (cause) => {
            const message = messages[index]
            const error = Cause.filterError(cause)
            // if we get a defect, then update storage
            if (Filter.isFail(error)) {
              return storage.saveReply(Reply.ReplyWithContext.fromDefect({
                id: snowflakeGen.nextUnsafe(),
                requestId: message.envelope.requestId,
                defect: Cause.squash(cause)
              }))
            }
            if (error._tag === "MailboxFull") {
              // MailboxFull can only happen for requests, so this cast is safe
              return resumeEntityFromStorage(message as Message.IncomingRequest<any>)
            }
            return Effect.void
          }
        )

        let index = 0
        yield* Effect.whileLoop({
          while: () => index < messages.length,
          step: () => index++,
          body: constant(send)
        })

        // let the resuming entities check if they are done
        yield* storageReadLock.release(1)

        while (sentRequestIdSets.size > 30) {
          const oldest = Iterable.headUnsafe(sentRequestIdSets)
          sentRequestIdSets.delete(oldest)
          for (const id of oldest) {
            sentRequestIds.delete(id)
          }
        }
      }
    }).pipe(
      Effect.scoped,
      Effect.ensuring(storageReadLock.releaseAll),
      Effect.catchCause((cause) => Effect.logWarning("Could not read messages from storage", cause)),
      Effect.annotateLogs({
        package: "@effect/cluster",
        module: "Sharding",
        fiber: "Storage read loop",
        runner: selfAddress
      }),
      Effect.forkIn(shardingScope)
    )

    // open the storage latch every poll interval
    yield* storageReadLatch.open.pipe(
      Effect.delay(config.entityMessagePollInterval),
      Effect.forever,
      Effect.forkIn(shardingScope)
    )

    // Resume unprocessed messages for entities that reached a full mailbox.
    const entityResumptionState = MutableHashMap.empty<EntityAddress, {
      unprocessed: Set<Snowflake.Snowflake>
      interrupts: Map<Snowflake.Snowflake, Message.IncomingEnvelope>
    }>()
    const resumeEntityFromStorage = (lastReceivedMessage: Message.IncomingRequest<any>) => {
      const address = lastReceivedMessage.envelope.address
      const resumptionState = MutableHashMap.get(entityResumptionState, address)
      if (Option.isSome(resumptionState)) {
        resumptionState.value.unprocessed.add(lastReceivedMessage.envelope.requestId)
        return Effect.void
      }
      MutableHashMap.set(entityResumptionState, address, {
        unprocessed: new Set([lastReceivedMessage.envelope.requestId]),
        interrupts: new Map()
      })
      return resumeEntityFromStorageImpl(address)
    }
    const resumeEntityFromStorageImpl = Effect.fnUntraced(
      function*(address: EntityAddress) {
        const state = entityManagers.get(address.entityType)
        if (!state) {
          MutableHashMap.remove(entityResumptionState, address)
          return
        }

        const resumptionState = Option.getOrThrow(MutableHashMap.get(entityResumptionState, address))
        let done = false

        while (!done) {
          // if the shard is no longer assigned to this runner, we stop
          if (!MutableHashSet.has(acquiredShards, address.shardId)) {
            return
          }

          // take a batch of unprocessed messages ids
          const messageIds = Arr.empty<Snowflake.Snowflake>()
          for (const id of resumptionState.unprocessed) {
            if (messageIds.length === 1024) break
            messageIds.push(id)
          }

          const messages = yield* storage.unprocessedMessagesById(messageIds)

          // this should not happen, but we handle it just in case
          if (messages.length === 0) {
            yield* Effect.sleep(config.entityMessagePollInterval)
            continue
          }

          let index = 0

          const sendWithRetry: Effect.Effect<
            void,
            EntityNotManagedByRunner | EntityNotAssignedToRunner
          > = Effect.catchTags(
            Effect.suspend(() => {
              if (!MutableHashSet.has(acquiredShards, address.shardId)) {
                return Effect.fail(new EntityNotAssignedToRunner({ address }))
              }

              const message = messages[index]
              // check if this is a request that was interrupted
              const interrupt = message._tag === "IncomingRequest" &&
                resumptionState.interrupts.get(message.envelope.requestId)
              return interrupt ?
                Effect.flatMap(state.manager.send(message), () => {
                  resumptionState.interrupts.delete(message.envelope.requestId)
                  return state.manager.send(interrupt)
                }) :
                state.manager.send(message)
            }),
            {
              MailboxFull: () => Effect.delay(sendWithRetry, config.sendRetryInterval),
              AlreadyProcessingMessage: () => Effect.void
            }
          )

          yield* Effect.whileLoop({
            while: () => index < messages.length,
            body: constant(sendWithRetry),
            step: () => index++
          })

          for (const id of messageIds) {
            resumptionState.unprocessed.delete(id)
          }
          if (resumptionState.unprocessed.size > 0) continue

          // if we have caught up to the main storage loop, we let it take over
          yield* withStorageReadLock(Effect.sync(() => {
            if (resumptionState.unprocessed.size === 0) {
              MutableHashMap.remove(entityResumptionState, address)
              done = true
            }
          }))
        }
      },
      Effect.retry({
        while: (e) => e._tag === "PersistenceError",
        schedule: Schedule.spaced(config.entityMessagePollInterval)
      }),
      Effect.catchCause((cause) => Effect.logError("Could not resume unprocessed messages", cause)),
      (effect, address) =>
        Effect.annotateLogs(effect, {
          package: "@effect/cluster",
          module: "Sharding",
          fiber: "Resuming unprocessed messages",
          runner: selfAddress,
          entity: address
        }),
      (effect, address) =>
        Effect.ensuring(
          effect,
          Effect.sync(() => MutableHashMap.remove(entityResumptionState, address))
        ),
      Effect.forkIn(shardingScope)
    )
  }

  // --- Sending messages ---

  const sendLocal = <M extends Message.Outgoing<any> | Message.Incoming<any>>(
    message: M
  ): Effect.Effect<
    void,
    | EntityNotAssignedToRunner
    | EntityNotManagedByRunner
    | MailboxFull
    | AlreadyProcessingMessage
    | (M extends Message.Incoming<any> ? never : PersistenceError)
  > =>
    Effect.suspend(() => {
      const address = message.envelope.address
      if (!isEntityOnLocalShards(address)) {
        return Effect.fail(new EntityNotAssignedToRunner({ address }))
      }
      const state = entityManagers.get(address.entityType)
      if (!state) {
        return Effect.fail(new EntityNotManagedByRunner({ address }))
      }

      return message._tag === "IncomingRequest" || message._tag === "IncomingEnvelope" ?
        state.manager.send(message) :
        runners.sendLocal({
          message,
          send: state.manager.sendLocal,
          simulateRemoteSerialization: config.simulateRemoteSerialization
        }) as any
    })

  const notifyLocal = <M extends Message.Outgoing<any> | Message.Incoming<any>>(
    message: M,
    discard: boolean
  ) =>
    Effect.suspend(
      (): Effect.Effect<
        void,
        | EntityNotManagedByRunner
        | EntityNotAssignedToRunner
        | AlreadyProcessingMessage
        | (M extends Message.Incoming<any> ? never : PersistenceError)
      > => {
        const address = message.envelope.address
        if (!isEntityOnLocalShards(address)) {
          return Effect.fail(new EntityNotAssignedToRunner({ address }))
        } else if (!entityManagers.has(address.entityType)) {
          return Effect.fail(new EntityNotManagedByRunner({ address }))
        }

        const notify = storageEnabled
          ? openStorageReadLatch
          : () => Effect.die("Sharding.notifyLocal: storage is disabled")

        if (message._tag === "IncomingRequest" || message._tag === "IncomingEnvelope") {
          if (message._tag === "IncomingRequest" && storageAlreadyProcessed(message)) {
            return Effect.fail(new AlreadyProcessingMessage({ address, envelopeId: message.envelope.requestId }))
          }
          return notify()
        }

        return runners.notifyLocal({ message, notify, discard }) as any
      }
    )

  function sendOutgoing(
    message: Message.Outgoing<any>,
    discard: boolean,
    retries?: number
  ): Effect.Effect<
    void,
    EntityNotManagedByRunner | MailboxFull | AlreadyProcessingMessage | PersistenceError
  > {
    return Effect.catchFilter(
      Effect.suspend(() => {
        const address = message.envelope.address
        const isPersisted = ServiceMap.get(message.rpc.annotations, Persisted)
        if (isPersisted && !storageEnabled) {
          return Effect.die("Sharding.sendOutgoing: Persisted messages require MessageStorage")
        }
        const maybeRunner = Option.getOrUndefined(MutableHashMap.get(shardAssignments, address.shardId))
        const runnerIsLocal = maybeRunner !== undefined && isLocalRunner(maybeRunner)
        if (isPersisted) {
          return runnerIsLocal
            ? notifyLocal(message, discard)
            : runners.notify({ address: maybeRunner, message, discard })
        } else if (maybeRunner === undefined) {
          return Effect.fail(new EntityNotAssignedToRunner({ address }))
        }
        return runnerIsLocal
          ? sendLocal(message)
          : runners.send({ address: maybeRunner, message })
      }),
      (error) =>
        error._tag === "EntityNotAssignedToRunner" || error._tag === "RunnerUnavailable" ? error : Filter.fail(error),
      (error) => {
        if (retries === 0) {
          return Effect.die(error)
        }
        return Effect.delay(sendOutgoing(message, discard, retries && retries - 1), config.sendRetryInterval)
      }
    )
  }

  const reset: Sharding["Service"]["reset"] = Effect.fnUntraced(
    function*(requestId) {
      yield* storage.clearReplies(requestId)
      sentRequestIds.delete(requestId)
    },
    Effect.matchCause({
      onSuccess: () => true,
      onFailure: () => false
    })
  )

  // --- RunnerStorage sync ---

  const selfRunner = config.runnerAddress ?
    new Runner({
      address: config.runnerAddress,
      groups: config.shardGroups,
      weight: config.runnerShardWeight
    }) :
    undefined

  if (selfRunner) {
    yield* Scope.addFinalizer(
      shardingScope,
      Effect.ignore(runnerStorage.unregister(selfRunner.address))
    )
  }

  let allRunners = MutableHashMap.empty<Runner, boolean>()

  yield* Effect.gen(function*() {
    const hashRings = new Map<string, HashRing.HashRing<RunnerAddress>>()
    const healthyRunners = MutableHashSet.empty<Runner>()
    let nextRunners = MutableHashMap.empty<Runner, boolean>()

    while (true) {
      // Ensure the current runner is registered
      if (selfRunner && !MutableHashMap.has(allRunners, selfRunner)) {
        yield* Effect.logDebug("Registering runner", selfRunner)
        const machineId = yield* runnerStorage.register(selfRunner)
        yield* snowflakeGen.setMachineId(machineId)
      }

      const runners = yield* runnerStorage.getRunners
      let changed = false
      for (let i = 0; i < runners.length; i++) {
        const [runner, healthy] = runners[i]
        MutableHashMap.set(nextRunners, runner, healthy)
        if (!healthy || MutableHashSet.has(healthyRunners, runner)) {
          continue
        }
        changed = true
        MutableHashSet.add(healthyRunners, runner)
        for (let j = 0; j < runner.groups.length; j++) {
          const group = runner.groups[j]
          let ring = hashRings.get(group)
          if (!ring) {
            ring = HashRing.make()
            hashRings.set(group, ring)
          }
          HashRing.add(ring, runner.address, { weight: runner.weight })
        }
      }

      // Remove runners that are no longer present or healthy
      for (const [runner, prevHealthy] of allRunners) {
        const ohealthy = MutableHashMap.get(nextRunners, runner)
        if (
          (ohealthy._tag === "Some" && ohealthy.value) ||
          (ohealthy._tag === "Some" && !prevHealthy)
        ) {
          continue
        }
        changed = true
        MutableHashSet.remove(healthyRunners, runner)
        for (let i = 0; i < runner.groups.length; i++) {
          HashRing.remove(hashRings.get(runner.groups[i])!, runner.address)
        }
      }

      // swap allRunners and nextRunners
      const prevRunners = allRunners
      allRunners = nextRunners
      nextRunners = prevRunners
      MutableHashMap.clear(nextRunners)

      // Recompute shard assignments if the set of healthy runners has changed.
      // We wait for an iteration with no changes to avoid thrashing.
      if (changed) {
        MutableHashSet.clear(selfShards)
        for (const [group, ring] of hashRings) {
          const newAssignments = HashRing.getShards(ring, config.shardsPerGroup)
          for (let i = 0; i < config.shardsPerGroup; i++) {
            const shard = makeShardId(group, i + 1)
            if (newAssignments) {
              const runner = newAssignments[i]
              MutableHashMap.set(shardAssignments, shard, runner)
              if (isLocalRunner(runner)) {
                MutableHashSet.add(selfShards, shard)
              }
            } else {
              MutableHashMap.remove(shardAssignments, shard)
            }
          }
        }
        yield* Effect.logDebug("New shard assignments", selfShards)
        activeShardsLatch.openUnsafe()
      }

      // Ensure the current runner is registered
      if (selfRunner && !MutableHashMap.has(allRunners, selfRunner)) {
        continue
      }
      yield* Effect.sleep(config.refreshAssignmentsInterval)
    }
  }).pipe(
    Effect.catchCause((cause) => Effect.logDebug(cause)),
    Effect.repeat(Schedule.spaced(1000)),
    Effect.annotateLogs({
      package: "@effect/cluster",
      module: "Sharding",
      fiber: "RunnerStorage sync",
      runner: config.runnerAddress
    }),
    Effect.forkIn(shardingScope)
  )

  // --- Runner health checks ---

  if (selfRunner) {
    yield* registerSingleton(
      "effect/cluster/Sharding/RunnerHealth",
      Effect.gen(function*() {
        const fiberSet = yield* FiberSet.make()

        while (true) {
          for (const [runner, healthy] of allRunners) {
            if (isLocalRunner(runner.address)) continue

            yield* runners.ping(runner.address).pipe(
              Effect.timeout("10 seconds"),
              Effect.retry({ times: 3 }),
              Effect.matchCauseEffect({
                onSuccess() {
                  if (healthy) return Effect.void
                  MutableHashMap.set(allRunners, runner, true)
                  return Effect.logDebug("Runner is healthy", runner).pipe(
                    Effect.andThen(runnerStorage.setRunnerHealth(runner.address, true))
                  )
                },
                onFailure() {
                  if (!healthy) return Effect.void
                  MutableHashMap.set(allRunners, runner, false)
                  return Effect.logDebug("Runner is unhealthy", runner).pipe(
                    Effect.andThen(runnerStorage.setRunnerHealth(runner.address, false))
                  )
                }
              }),
              FiberSet.run(fiberSet)
            )
          }
          yield* FiberSet.awaitEmpty(fiberSet)
          yield* Effect.sleep(config.runnerHealthCheckInterval)
        }
      }).pipe(
        Effect.annotateLogs({
          package: "@effect/cluster",
          module: "Sharding",
          fiber: "Runner health check"
        })
      )
    )
  }

  // --- Clients ---

  type ClientRequestEntry = {
    readonly rpc: Rpc.AnyWithProps
    readonly services: ServiceMap.ServiceMap<never>
    lastChunkId?: Snowflake.Snowflake
  }
  const clientRequests = new Map<Snowflake.Snowflake, ClientRequestEntry>()

  const clients: ResourceMap<
    Entity<any, any>,
    (entityId: string) => RpcClient.RpcClient<
      any,
      MailboxFull | AlreadyProcessingMessage | EntityNotManagedByRunner
    >,
    never
  > = yield* ResourceMap.make(Effect.fnUntraced(function*(entity: Entity<string, any>) {
    const client = yield* RpcClient.makeNoSerialization(entity.protocol, {
      spanPrefix: `${entity.type}.client`,
      disableTracing: !ServiceMap.get(entity.protocol.annotations, ClusterSchema.ClientTracingEnabled),
      supportsAck: true,
      generateRequestId: () => RequestId(snowflakeGen.nextUnsafe()),
      flatten: true,
      onFromClient(options): Effect.Effect<
        void,
        MailboxFull | AlreadyProcessingMessage | EntityNotManagedByRunner | PersistenceError
      > {
        const address = ServiceMap.getUnsafe(options.context, ClientAddressTag)
        switch (options.message._tag) {
          case "Request": {
            const fiber = Fiber.getCurrent()!
            const id = Snowflake.Snowflake(options.message.id)
            const rpc = entity.protocol.requests.get(options.message.tag)!
            let respond: (reply: Reply.Reply<any>) => Effect.Effect<void>
            if (!options.discard) {
              const entry: ClientRequestEntry = {
                rpc: rpc as any,
                services: fiber.services
              }
              clientRequests.set(id, entry)
              respond = makeClientRespond(entry, client.write)
            } else {
              respond = clientRespondDiscard
            }
            return sendOutgoing(
              new Message.OutgoingRequest({
                envelope: Envelope.makeRequest({
                  requestId: id,
                  address,
                  tag: options.message.tag,
                  payload: options.message.payload,
                  headers: options.message.headers,
                  traceId: options.message.traceId,
                  spanId: options.message.spanId,
                  sampled: options.message.sampled
                }),
                lastReceivedReply: undefined,
                rpc,
                services: fiber.services as ServiceMap.ServiceMap<any>,
                respond
              }),
              options.discard
            )
          }
          case "Ack": {
            const requestId = Snowflake.Snowflake(options.message.requestId)
            const entry = clientRequests.get(requestId)
            if (!entry) return Effect.void
            return sendOutgoing(
              new Message.OutgoingEnvelope({
                envelope: new Envelope.AckChunk({
                  id: snowflakeGen.nextUnsafe(),
                  address,
                  requestId,
                  replyId: entry.lastChunkId!
                }),
                rpc: entry.rpc
              }),
              false
            )
          }
          case "Interrupt": {
            const requestId = Snowflake.Snowflake(options.message.requestId)
            const entry = clientRequests.get(requestId)!
            if (!entry) return Effect.void
            clientRequests.delete(requestId)
            if (ServiceMap.get(entry.rpc.annotations, Uninterruptible)) {
              return Effect.void
            }
            // for durable messages, we ignore interrupts on shutdown or as a
            // result of a shard being resassigned
            const isTransientInterrupt = MutableRef.get(isShutdown) ||
              options.message.interruptors.some((id) => internalInterruptors.has(id))
            if (isTransientInterrupt && ServiceMap.get(entry.rpc.annotations, Persisted)) {
              return Effect.void
            }
            return Effect.ignore(sendOutgoing(
              new Message.OutgoingEnvelope({
                envelope: new Envelope.Interrupt({
                  id: snowflakeGen.nextUnsafe(),
                  address,
                  requestId
                }),
                rpc: entry.rpc
              }),
              false,
              3
            ))
          }
        }
        return Effect.void
      }
    })

    yield* Scope.addFinalizer(
      yield* Effect.scope,
      Effect.withFiber((fiber) => {
        internalInterruptors.add(fiber.id)
        return Effect.void
      })
    )

    return (entityId: string) => {
      const id = makeEntityId(entityId)
      const address = ClientAddressTag.serviceMap(makeEntityAddress({
        shardId: getShardId(id, entity.getShardGroup(entityId as EntityId)),
        entityId: id,
        entityType: entity.type
      }))
      const clientFn = function(tag: string, payload: any, options?: {
        readonly context?: ServiceMap.ServiceMap<never>
      }) {
        const context = options?.context ? ServiceMap.merge(options.context, address) : address
        return client.client(tag, payload, {
          ...options,
          context
        })
      }
      const proxyClient: any = {}
      return new Proxy(proxyClient, {
        has(_, p) {
          return entity.protocol.requests.has(p as string)
        },
        get(target, p) {
          if (p in target) {
            return target[p]
          } else if (!entity.protocol.requests.has(p as string)) {
            return undefined
          }
          return target[p] = (payload: any, options?: {}) => clientFn(p as string, payload, options)
        }
      })
    }
  }))

  const makeClient = <Type extends string, Rpcs extends Rpc.Any>(entity: Entity<Type, Rpcs>): Effect.Effect<
    (
      entityId: string
    ) => RpcClient.RpcClient.From<Rpcs, MailboxFull | AlreadyProcessingMessage | EntityNotManagedByRunner>
  > => clients.get(entity) as any

  const clientRespondDiscard = (_reply: Reply.Reply<any>) => Effect.void

  const makeClientRespond = (
    entry: ClientRequestEntry,
    write: (reply: FromServer<any>) => Effect.Effect<void>
  ) =>
  (reply: Reply.Reply<any>) => {
    switch (reply._tag) {
      case "Chunk": {
        entry.lastChunkId = reply.id
        return write({
          _tag: "Chunk",
          clientId: 0,
          requestId: RequestId(reply.requestId),
          values: reply.values
        })
      }
      case "WithExit": {
        clientRequests.delete(reply.requestId)
        return write({
          _tag: "Exit",
          clientId: 0,
          requestId: RequestId(reply.requestId),
          exit: reply.exit
        })
      }
    }
  }

  // --- Entities ---

  const services = yield* Effect.services<ShardingConfig>()
  const reaper = yield* EntityReaper
  const registerEntity: Sharding["Service"]["registerEntity"] = Effect.fnUntraced(
    function*(entity, build, options) {
      if (config.runnerAddress === undefined || entityManagers.has(entity.type)) return
      const scope = yield* Scope.make()
      const manager = yield* EntityManager.make(entity, build, {
        ...options,
        storage,
        runnerAddress: config.runnerAddress,
        sharding
      }).pipe(
        Effect.provideServices(services.pipe(
          ServiceMap.add(EntityReaper, reaper),
          ServiceMap.add(Scope.Scope, scope),
          ServiceMap.add(Snowflake.Generator, snowflakeGen)
        ))
      ) as Effect.Effect<EntityManager.EntityManager>
      entityManagers.set(entity.type, {
        entity,
        scope,
        manager
      })

      yield* PubSub.publish(events, EntityRegistered({ entity }))
    }
  )

  yield* Scope.addFinalizerExit(
    shardingScope,
    (exit) =>
      Effect.forEach(
        entityManagers.values(),
        (state) =>
          Effect.catchCause(Scope.close(state.scope, exit), (cause) =>
            Effect.annotateLogs(Effect.logError("Error closing entity manager", cause), {
              entity: state.entity.type
            })),
        { concurrency: "unbounded", discard: true }
      )
  )

  // --- Finalization ---

  yield* Scope.addFinalizer(
    shardingScope,
    Effect.withFiber((fiber) => {
      MutableRef.set(isShutdown, true)
      internalInterruptors.add(fiber.id)
      return Effect.void
    })
  )

  const activeEntityCount = Effect.gen(function*() {
    let count = 0
    for (const state of entityManagers.values()) {
      count += yield* state.manager.activeEntityCount
    }
    return count
  })

  const sharding = Sharding.of({
    getRegistrationEvents,
    getShardId,
    isShutdown: Effect.sync(() => MutableRef.get(isShutdown)),
    registerEntity,
    registerSingleton,
    makeClient,
    send: sendLocal,
    sendOutgoing: (message, discard) => sendOutgoing(message, discard),
    notify: (message) => notifyLocal(message, false),
    activeEntityCount,
    pollStorage: storageReadLatch.open,
    reset
  })

  return sharding
})

/**
 * @since 4.0.0
 * @category layers
 */
export const layer: Layer.Layer<
  Sharding,
  never,
  ShardingConfig | Runners | MessageStorage.MessageStorage | RunnerStorage
> = Layer.effect(Sharding)(make).pipe(
  Layer.provide([Snowflake.layerGenerator, EntityReaper.layer])
)

// Utilities

const ClientAddressTag = ServiceMap.Key<EntityAddress>("effect/cluster/Sharding/ClientAddress")
