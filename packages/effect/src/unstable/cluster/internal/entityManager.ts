import * as Cause from "../../../Cause.ts"
import * as Arr from "../../../collections/Array.ts"
import * as Option from "../../../data/Option.ts"
import * as UndefinedOr from "../../../data/UndefinedOr.ts"
import * as Effect from "../../../Effect.ts"
import * as Exit from "../../../Exit.ts"
import { identity } from "../../../Function.ts"
import * as Equal from "../../../interfaces/Equal.ts"
import * as Metric from "../../../observability/Metric.ts"
import { CurrentLogAnnotations } from "../../../References.ts"
import * as Schedule from "../../../Schedule.ts"
import * as Schema from "../../../schema/Schema.ts"
import * as Serializer from "../../../schema/Serializer.ts"
import * as Scope from "../../../Scope.ts"
import * as ServiceMap from "../../../ServiceMap.ts"
import { Clock } from "../../../time/Clock.ts"
import * as Duration from "../../../time/Duration.ts"
import type { DurationInput } from "../../../time/Duration.ts"
import type * as Rpc from "../../rpc/Rpc.ts"
import { RequestId } from "../../rpc/RpcMessage.ts"
import * as RpcServer from "../../rpc/RpcServer.ts"
import { AlreadyProcessingMessage, EntityNotAssignedToRunner, MailboxFull, MalformedMessage } from "../ClusterError.ts"
import * as ClusterMetrics from "../ClusterMetrics.ts"
import { Persisted, Uninterruptible } from "../ClusterSchema.ts"
import type { Entity, HandlersFrom } from "../Entity.ts"
import { CurrentAddress, CurrentRunnerAddress, Request } from "../Entity.ts"
import type { EntityAddress } from "../EntityAddress.ts"
import type { EntityId } from "../EntityId.ts"
import * as Envelope from "../Envelope.ts"
import * as Message from "../Message.ts"
import * as MessageStorage from "../MessageStorage.ts"
import * as Reply from "../Reply.ts"
import type { RunnerAddress } from "../RunnerAddress.ts"
import type { ShardId } from "../ShardId.ts"
import type { Sharding } from "../Sharding.ts"
import { ShardingConfig } from "../ShardingConfig.ts"
import * as Snowflake from "../Snowflake.ts"
import { EntityReaper } from "./entityReaper.ts"
import { internalInterruptors } from "./interruptors.ts"
import { ResourceMap } from "./resourceMap.ts"
import { ResourceRef } from "./resourceRef.ts"

/** @internal */
export interface EntityManager {
  readonly sendLocal: <R extends Rpc.Any>(
    message: Message.IncomingLocal<R>
  ) => Effect.Effect<void, EntityNotAssignedToRunner | MailboxFull | AlreadyProcessingMessage>

  readonly send: (
    message: Message.Incoming<any>
  ) => Effect.Effect<void, EntityNotAssignedToRunner | MailboxFull | AlreadyProcessingMessage>

  readonly isProcessingFor: (message: Message.Incoming<any>, options?: {
    readonly excludeReplies?: boolean
  }) => boolean

  readonly interruptShard: (shardId: ShardId) => Effect.Effect<void>

  readonly activeEntityCount: Effect.Effect<number>
}

// Represents the entities managed by this entity manager
/** @internal */
export type EntityState = {
  readonly address: EntityAddress
  readonly activeRequests: Map<bigint, {
    readonly rpc: Rpc.AnyWithProps
    readonly message: Message.IncomingRequestLocal<any>
    sentReply: boolean
    lastSentChunk: Option.Option<Reply.Chunk<Rpc.Any>>
    sequence: number
  }>
  lastActiveCheck: number
  write: RpcServer.RpcServer<any>["write"]
}

/** @internal */
export const make = Effect.fnUntraced(function*<
  Type extends string,
  Rpcs extends Rpc.Any,
  Handlers extends HandlersFrom<Rpcs>,
  RX
>(
  entity: Entity<Type, Rpcs>,
  buildHandlers: Effect.Effect<Handlers, never, RX>,
  options: {
    readonly sharding: Sharding["Service"]
    readonly storage: MessageStorage.MessageStorage["Service"]
    readonly runnerAddress: RunnerAddress
    readonly maxIdleTime?: DurationInput | undefined
    readonly concurrency?: number | "unbounded" | undefined
    readonly mailboxCapacity?: number | "unbounded" | undefined
    readonly disableFatalDefects?: boolean | undefined
    readonly defectRetryPolicy?: Schedule.Schedule<any, unknown, never, never> | undefined
    readonly spanAttributes?: Record<string, string> | undefined
  }
) {
  const config = yield* ShardingConfig
  const snowflakeGen = yield* Snowflake.Generator
  const managerScope = yield* Effect.scope
  const storageEnabled = options.storage !== MessageStorage.noop
  const mailboxCapacity = options.mailboxCapacity ?? config.entityMailboxCapacity
  const clock = yield* Clock
  const services = yield* Effect.services<Rpc.Services<Rpcs> | Rpc.Middleware<Rpcs> | RX>()
  const retryDriver = yield* Schedule.toStepWithSleep(
    options.defectRetryPolicy ? Schedule.andThen(options.defectRetryPolicy, defaultRetryPolicy) : defaultRetryPolicy
  )

  const activeServers = new Map<EntityId, EntityState>()

  const entities: ResourceMap<
    EntityAddress,
    EntityState,
    EntityNotAssignedToRunner
  > = yield* ResourceMap.make(Effect.fnUntraced(function*(address) {
    if (yield* options.sharding.isShutdown) {
      return yield* Effect.fail(new EntityNotAssignedToRunner({ address }))
    }

    const scope = yield* Effect.scope
    const endLatch = Effect.makeLatchUnsafe()

    // on shutdown, reset the storage for the entity
    yield* Scope.addFinalizer(
      scope,
      Effect.ignore(options.storage.resetAddress(address))
    )

    const activeRequests: EntityState["activeRequests"] = new Map()
    let defectRequestIds: Array<bigint> = []

    // the server is stored in a ref, so if there is a defect, we can
    // swap the server without losing the active requests
    const writeRef = yield* ResourceRef.from(
      scope,
      Effect.fnUntraced(function*(scope) {
        let isShuttingDown = false

        // Initiate the behavior for the entity
        const handlers = yield* (entity.protocol.toHandlers(buildHandlers as any).pipe(
          Effect.provideService(CurrentLogAnnotations, {}),
          Effect.provideServices(services.pipe(
            ServiceMap.add(CurrentAddress, address),
            ServiceMap.add(CurrentRunnerAddress, options.runnerAddress),
            ServiceMap.add(Scope.Scope, scope)
          ))
        ) as Effect.Effect<ServiceMap.ServiceMap<Rpc.ToHandler<Rpcs>>>)

        const server = yield* RpcServer.makeNoSerialization(entity.protocol, {
          spanPrefix: `${entity.type}(${address.entityId})`,
          spanAttributes: {
            ...options.spanAttributes,
            "entity.type": entity.type,
            "entity.id": address.entityId
          },
          concurrency: options.concurrency ?? 1,
          disableFatalDefects: options.disableFatalDefects,
          onFromServer(response): Effect.Effect<void> {
            switch (response._tag) {
              case "Exit": {
                const request = activeRequests.get(response.requestId)
                if (!request) return Effect.void

                request.sentReply = true

                // For durable messages, ignore interrupts during shutdown.
                // They will be retried when the entity is restarted.
                // Also, if the request is uninterruptible, we ignore the
                // interrupt.
                if (
                  storageEnabled &&
                  ServiceMap.get(request.rpc.annotations, Persisted) &&
                  Exit.hasInterrupt(response.exit) &&
                  (isShuttingDown || ServiceMap.get(request.rpc.annotations, Uninterruptible))
                ) {
                  return Effect.void
                }

                return retryRespond(
                  4,
                  Effect.suspend(() =>
                    request.message.respond(
                      new Reply.WithExit({
                        requestId: Snowflake.Snowflake(response.requestId),
                        id: snowflakeGen.nextUnsafe(),
                        exit: response.exit
                      })
                    )
                  )
                ).pipe(
                  Effect.flatMap(() => {
                    activeRequests.delete(response.requestId)

                    // ensure that the reaper does not remove the entity as we haven't
                    // been "idle" yet
                    if (activeRequests.size === 0) {
                      state.lastActiveCheck = clock.currentTimeMillisUnsafe()
                    }

                    return Effect.void
                  }),
                  Effect.orDie
                )
              }
              case "Chunk": {
                const request = activeRequests.get(response.requestId)
                if (!request) return Effect.void
                const sequence = request.sequence
                request.sequence++
                if (!request.sentReply) {
                  request.sentReply = true
                }
                return Effect.orDie(retryRespond(
                  4,
                  Effect.suspend(() => {
                    const reply = new Reply.Chunk({
                      requestId: Snowflake.Snowflake(response.requestId),
                      id: snowflakeGen.nextUnsafe(),
                      sequence,
                      values: response.values
                    })
                    request.lastSentChunk = Option.some(reply)
                    return request.message.respond(reply)
                  })
                ))
              }
              case "Defect": {
                return Effect.forkIn(onDefect(Cause.die(response.defect)), managerScope)
              }
              case "ClientEnd": {
                return endLatch.open
              }
            }
          }
        }).pipe(
          Scope.provide(scope),
          Effect.provideServices(handlers)
        )

        yield* Scope.addFinalizer(
          scope,
          Effect.sync(() => {
            isShuttingDown = true
          })
        )

        for (const id of defectRequestIds) {
          const { lastSentChunk, message } = activeRequests.get(id)!
          yield* server.write(0, {
            ...message.envelope,
            id: RequestId(message.envelope.requestId),
            tag: message.envelope.tag as any,
            payload: new Request({
              ...message.envelope,
              lastSentChunk
            } as any) as any
          })
        }
        defectRequestIds = []

        return server.write
      })
    )

    function onDefect(cause: Cause.Cause<never>): Effect.Effect<void> {
      const effect = writeRef.rebuildUnsafe()
      defectRequestIds = Array.from(activeRequests.keys())
      return Effect.logError("Defect in entity, restarting", cause).pipe(
        Effect.andThen(Effect.ignore(retryDriver(void 0))),
        Effect.andThen(effect),
        Effect.annotateLogs({
          module: "EntityManager",
          address,
          runner: options.runnerAddress
        }),
        Effect.catchCause(onDefect)
      )
    }

    const state: EntityState = {
      address,
      write(clientId, message) {
        if (writeRef.state.current._tag !== "Acquired") {
          return Effect.flatMap(writeRef.await, (write) => write(clientId, message))
        }
        return writeRef.state.current.value(clientId, message)
      },
      activeRequests,
      lastActiveCheck: clock.currentTimeMillisUnsafe()
    }

    // During shutdown, signal that no more messages will be processed
    // and wait for the fiber to complete.
    //
    // If the termination timeout is reached, let the server clean itself up
    yield* Scope.addFinalizer(
      scope,
      Effect.withFiber((fiber) => {
        activeServers.delete(address.entityId)
        internalInterruptors.add(fiber.id)
        return state.write(0, { _tag: "Eof" }).pipe(
          Effect.andThen(Effect.interruptible(endLatch.await)),
          Effect.timeoutOption(config.entityTerminationTimeout)
        )
      })
    )
    activeServers.set(address.entityId, state)

    return state
  }, Effect.provideService(CurrentLogAnnotations, {})))

  const reaper = yield* EntityReaper
  const maxIdleTime = Duration.toMillis(options.maxIdleTime ?? config.entityMaxIdleTime)
  if (Number.isFinite(maxIdleTime)) {
    yield* reaper.register({
      maxIdleTime,
      servers: activeServers,
      entities
    })
  }

  // update metrics for active servers
  const typeAttributes = Metric.CurrentMetricAttributes.serviceMap({ type: entity.type })
  yield* Effect.sync(() => {
    ClusterMetrics.entities.updateUnsafe(BigInt(activeServers.size), typeAttributes)
  }).pipe(
    Effect.andThen(Effect.sleep(1000)),
    Effect.forever,
    Effect.forkIn(managerScope)
  )

  function sendLocal<R extends Rpc.Any>(
    message: Message.IncomingLocal<R>
  ): Effect.Effect<void, EntityNotAssignedToRunner | MailboxFull | AlreadyProcessingMessage> {
    return Effect.provideService(
      Effect.flatMap(
        entities.get(message.envelope.address),
        (server): Effect.Effect<void, EntityNotAssignedToRunner | MailboxFull | AlreadyProcessingMessage> => {
          switch (message._tag) {
            case "IncomingRequestLocal": {
              // If the request is already running, then we might have more than
              // one sender for the same request. In this case, the other senders
              // should resume from storage only.
              let entry = server.activeRequests.get(message.envelope.requestId)
              if (entry) {
                return Effect.fail(
                  new AlreadyProcessingMessage({
                    envelopeId: message.envelope.requestId,
                    address: message.envelope.address
                  })
                )
              }

              const rpc = entity.protocol.requests.get(message.envelope.tag)! as any as Rpc.AnyWithProps
              if (!storageEnabled && ServiceMap.get(rpc.annotations, Persisted)) {
                return Effect.die(
                  "EntityManager.sendLocal: Cannot process a persisted message without MessageStorage"
                )
              }

              if (mailboxCapacity !== "unbounded" && server.activeRequests.size >= mailboxCapacity) {
                return Effect.fail(new MailboxFull({ address: message.envelope.address }))
              }

              entry = {
                rpc,
                message,
                sentReply: false,
                lastSentChunk: message.lastSentReply as any,
                sequence: UndefinedOr.match(message.lastSentReply, {
                  onUndefined: () => 0,
                  onDefined: (reply) => reply._tag === "Chunk" ? reply.sequence + 1 : 0
                })
              }
              server.activeRequests.set(message.envelope.requestId, entry)
              return server.write(0, {
                ...message.envelope,
                id: RequestId(message.envelope.requestId),
                payload: new Request({
                  ...message.envelope,
                  lastSentChunk: message.lastSentReply as any
                })
              })
            }
            case "IncomingEnvelope": {
              const entry = server.activeRequests.get(message.envelope.requestId)
              if (!entry) {
                return Effect.void
              } else if (
                message.envelope._tag === "AckChunk" &&
                Option.isSome(entry.lastSentChunk) &&
                message.envelope.replyId !== entry.lastSentChunk.value.id
              ) {
                return Effect.void
              }
              return server.write(
                0,
                message.envelope._tag === "AckChunk"
                  ? { _tag: "Ack", requestId: RequestId(message.envelope.requestId) }
                  : { _tag: "Interrupt", requestId: RequestId(message.envelope.requestId), interruptors: [] }
              )
            }
          }
        }
      ),
      CurrentLogAnnotations,
      {}
    )
  }

  const interruptShard = (shardId: ShardId) =>
    Effect.suspend(function loop(): Effect.Effect<void> {
      const toInterrupt = new Set<EntityState>()
      for (const state of activeServers.values()) {
        if (shardId[Equal.symbol](state.address.shardId)) {
          toInterrupt.add(state)
        }
      }
      if (toInterrupt.size === 0) {
        return Effect.void
      }
      return Effect.flatMap(
        Effect.forEach(toInterrupt, (state) => entities.removeIgnore(state.address), {
          concurrency: "unbounded",
          discard: true
        }),
        loop
      )
    })

  const decodeMessage = Schema.decodeEffect(makeMessageSchema(entity))

  return identity<EntityManager>({
    interruptShard,
    isProcessingFor(message, options) {
      const state = activeServers.get(message.envelope.address.entityId)
      if (!state) return false
      const request = state.activeRequests.get(message.envelope.requestId)
      if (request === undefined) {
        return false
      } else if (options?.excludeReplies && request.sentReply) {
        return false
      }
      return true
    },
    sendLocal,
    send: (message) =>
      decodeMessage(message).pipe(
        Effect.matchEffect({
          onFailure: (cause) => {
            if (message._tag === "IncomingEnvelope") {
              return Effect.die(new MalformedMessage({ cause }))
            }
            return Effect.orDie(message.respond(
              new Reply.ReplyWithContext({
                reply: new Reply.WithExit({
                  id: snowflakeGen.nextUnsafe(),
                  requestId: message.envelope.requestId,
                  exit: Exit.die(new MalformedMessage({ cause }))
                }),
                rpc: entity.protocol.requests.get(message.envelope.tag)!,
                services: services as any
              })
            ))
          },
          onSuccess: (decoded) => {
            if (decoded._tag === "IncomingEnvelope") {
              return sendLocal(
                new Message.IncomingEnvelope(decoded)
              )
            }
            const request = message as Message.IncomingRequest<any>
            const rpc = entity.protocol.requests.get(decoded.envelope.tag)!
            return sendLocal(
              new Message.IncomingRequestLocal({
                envelope: decoded.envelope,
                lastSentReply: decoded.lastSentReply,
                respond: (reply) =>
                  request.respond(
                    new Reply.ReplyWithContext({
                      reply,
                      rpc,
                      services: services as any
                    })
                  )
              })
            )
          }
        }),
        Effect.provideServices(services as ServiceMap.ServiceMap<unknown>)
      ),
    activeEntityCount: Effect.sync(() => activeServers.size)
  })
})

const defaultRetryPolicy = Schedule.exponential(500, 1.5).pipe(
  Schedule.either(Schedule.spaced("10 seconds"))
)

const makeMessageSchema = <Type extends string, Rpcs extends Rpc.Any>(entity: Entity<Type, Rpcs>): Schema.Codec<
  {
    readonly _tag: "IncomingRequest"
    readonly envelope: Envelope.Request.Any
    readonly lastSentReply: Reply.Reply<Rpcs> | undefined
  } | {
    readonly _tag: "IncomingEnvelope"
    readonly envelope: Envelope.AckChunk | Envelope.Interrupt
  },
  Message.Incoming<Rpcs>,
  Rpc.ServicesServer<Rpcs>,
  Rpc.ServicesClient<Rpcs>
> => {
  const requests = Arr.empty<Schema.Top>()

  for (const rpc of entity.protocol.requests.values()) {
    requests.push(
      Schema.TaggedStruct("IncomingRequest", {
        envelope: Schema.Struct({
          ...Envelope.PartialRequest.fields,
          tag: Schema.Literal(rpc._tag),
          payload: Serializer.json((rpc as any as Rpc.AnyWithProps).payloadSchema)
        }).pipe(
          Schema.decodeTo(Envelope.Request, Envelope.RequestTransform)
        ),
        lastSentReply: Schema.Option(Reply.Reply(rpc))
      })
    )
  }

  return Schema.Union([
    ...requests,
    Schema.TaggedStruct("IncomingEnvelope", {
      envelope: Schema.Union([
        Schema.typeCodec(Envelope.AckChunk),
        Schema.typeCodec(Envelope.Interrupt)
      ])
    })
  ]) as any
}

const retryRespond = <A, E, R>(times: number, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  times === 0 ?
    effect :
    Effect.catch(effect, () => Effect.delay(retryRespond(times - 1, effect), 200))
