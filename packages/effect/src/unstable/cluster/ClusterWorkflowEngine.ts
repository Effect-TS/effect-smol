/**
 * @since 4.0.0
 */
import * as Record from "../../data/Record.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as PrimaryKey from "../../interfaces/PrimaryKey.ts"
import * as Layer from "../../Layer.ts"
import * as RcMap from "../../RcMap.ts"
import * as Schedule from "../../Schedule.ts"
import { Serializer } from "../../schema/index.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as DateTime from "../../time/DateTime.ts"
import * as Duration from "../../time/Duration.ts"
import * as Rpc from "../rpc/Rpc.ts"
import * as Activity from "../workflow/Activity.ts"
import * as DurableClock from "../workflow/DurableClock.ts"
import * as DurableDeferred from "../workflow/DurableDeferred.ts"
import * as Workflow from "../workflow/Workflow.ts"
import { WorkflowEngine, WorkflowInstance } from "../workflow/WorkflowEngine.ts"
import * as ClusterSchema from "./ClusterSchema.ts"
import * as DeliverAt from "./DeliverAt.ts"
import * as Entity from "./Entity.ts"
import * as EntityAddress from "./EntityAddress.ts"
import * as EntityId from "./EntityId.ts"
import * as EntityType from "./EntityType.ts"
import { MessageStorage } from "./MessageStorage.ts"
import type { WithExitEncoded } from "./Reply.ts"
import * as Reply from "./Reply.ts"
import * as Sharding from "./Sharding.ts"
import * as Snowflake from "./Snowflake.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = Effect.gen(function*() {
  const sharding = yield* Sharding.Sharding
  const storage = yield* MessageStorage

  const workflows = new Map<string, Workflow.Any>()
  const entities = new Map<
    string,
    Entity.Entity<
      string,
      | Rpc.Rpc<
        "run",
        Schema.Struct<
          Record<
            typeof payloadParentKey,
            Schema.optional<
              Schema.Struct<{
                workflowName: typeof Schema.String
                executionId: typeof Schema.String
              }>
            >
          >
        >,
        Schema.declare<Workflow.Result<any, any>>
      >
      | Rpc.Rpc<"deferred", Schema.Struct<{ name: typeof Schema.String; exit: typeof ExitUnknown }>, typeof ExitUnknown>
      | Rpc.Rpc<
        "activity",
        Schema.Struct<{ name: typeof Schema.String; attempt: typeof Schema.Number }>,
        Schema.declare<Workflow.Result<any, any>>
      >
      | Rpc.Rpc<"resume">
    >
  >()
  const partialEntities = new Map<
    string,
    Entity.Entity<
      string,
      | Rpc.Rpc<"deferred", Schema.Struct<{ name: typeof Schema.String; exit: typeof ExitUnknown }>, typeof ExitUnknown>
      | Rpc.Rpc<
        "activity",
        Schema.Struct<{ name: typeof Schema.String; attempt: typeof Schema.Number }>,
        Schema.declare<Workflow.Result<any, any>>
      >
      | Rpc.Rpc<"resume">
    >
  >()
  const ensureEntity = (workflow: Workflow.Any) => {
    let entity = entities.get(workflow.name)
    if (!entity) {
      entity = makeWorkflowEntity(workflow as any) as any
      workflows.set(workflow.name, workflow)
      entities.set(workflow.name, entity as any)
    }
    return entity!
  }
  const ensurePartialEntity = (workflowName: string) => {
    let entity = partialEntities.get(workflowName)
    if (!entity) {
      entity = makePartialWorkflowEntity(workflowName) as any
      partialEntities.set(workflowName, entity as any)
    }
    return entity!
  }

  const activities = new Map<string, {
    readonly activity: Activity.Any
    readonly services: ServiceMap.ServiceMap<any>
  }>()
  const activityLatches = new Map<string, Effect.Latch>()
  const clients = yield* RcMap.make({
    lookup: Effect.fnUntraced(function*(workflowName: string) {
      const entity = entities.get(workflowName)
      if (!entity) {
        return yield* Effect.die(`Workflow ${workflowName} not registered`)
      }
      return yield* entity.client
    }),
    idleTimeToLive: "5 minutes"
  })
  const clientsPartial = yield* RcMap.make({
    lookup: Effect.fnUntraced(function*(workflowName: string) {
      const entity = entities.get(workflowName) ?? ensurePartialEntity(workflowName)
      return yield* entity.client
    }),
    idleTimeToLive: "5 minutes"
  })
  const clockClient = yield* ClockEntity.client

  const requestIdFor = Effect.fnUntraced(function*(options: {
    readonly workflow: Workflow.Any
    readonly entityType: string
    readonly executionId: string
    readonly tag: string
    readonly id: string
  }) {
    const shardGroup = ServiceMap.get(options.workflow.annotations, ClusterSchema.ShardGroup)(
      options.executionId as EntityId.EntityId
    )
    const entityId = EntityId.make(options.executionId)
    const address = EntityAddress.make({
      entityType: EntityType.make(options.entityType),
      entityId,
      shardId: sharding.getShardId(entityId, shardGroup)
    })
    return yield* storage.requestIdForPrimaryKey({ address, tag: options.tag, id: options.id })
  })

  const replyForRequestId = Effect.fnUntraced(function*(requestId: Snowflake.Snowflake) {
    const replies = yield* storage.repliesForUnfiltered([requestId])
    const last = replies.at(-1)
    if (last && last._tag === "WithExit") {
      return last as WithExitEncoded<Workflow.ResultEncoded<any, any>>
    }
  })

  const requestReply = Effect.fnUntraced(function*(options: {
    readonly workflow: Workflow.Any
    readonly entityType: string
    readonly executionId: string
    readonly tag: string
    readonly id: string
  }) {
    const requestId = yield* requestIdFor(options)
    if (requestId === undefined) {
      return undefined
    }
    return yield* replyForRequestId(requestId)
  })

  const resetActivityAttempt = Effect.fnUntraced(
    function*(options: {
      readonly workflow: Workflow.Any
      readonly executionId: string
      readonly activity: Activity.Any
      readonly attempt: number
    }) {
      const requestId = yield* requestIdFor({
        workflow: options.workflow,
        entityType: `Workflow/${options.workflow.name}`,
        executionId: options.executionId,
        tag: "activity",
        id: activityPrimaryKey(options.activity.name, options.attempt)
      })
      if (requestId === undefined) return
      yield* sharding.reset(requestId)
    },
    Effect.retry({
      times: 3,
      schedule: Schedule.exponential(250)
    }),
    Effect.orDie,
    (effect, { activity, attempt, executionId }) =>
      Effect.withSpan(effect, "WorkflowEngine.resetActivityAttempt", {
        captureStackTrace: false,
        attributes: {
          name: activity.name,
          executionId,
          attempt
        }
      })
  )

  const clearClock = Effect.fnUntraced(function*(options: {
    readonly workflow: Workflow.Any
    readonly executionId: string
  }) {
    const shardGroup = ServiceMap.get(options.workflow.annotations, ClusterSchema.ShardGroup)(
      options.executionId as EntityId.EntityId
    )
    const entityId = EntityId.make(options.executionId)
    const shardId = sharding.getShardId(entityId, shardGroup)
    const clockAddress = EntityAddress.make({
      entityType: ClockEntity.type,
      entityId,
      shardId
    })
    yield* storage.clearAddress(clockAddress)
  })

  const resume = Effect.fnUntraced(function*(workflow: Workflow.Any, executionId: string) {
    const maybeReply = yield* requestReply({
      workflow,
      entityType: `Workflow/${workflow.name}`,
      executionId,
      tag: "run",
      id: ""
    })

    const maybeSuspended =
      maybeReply && maybeReply.exit._tag === "Success" && maybeReply.exit.value._tag === "Suspended"
        ? maybeReply
        : undefined

    if (maybeSuspended === undefined) return
    yield* sharding.reset(Snowflake.Snowflake(maybeSuspended.requestId))
    yield* sharding.pollStorage
  })

  const sendResumeParent = Effect.fnUntraced(function*(options: {
    readonly workflowName: string
    readonly executionId: string
  }) {
    const client = (yield* RcMap.get(clientsPartial, options.workflowName))(options.executionId)
    return yield* client.resume(void 0, { discard: true })
  }, Effect.scoped)

  return WorkflowEngine.of({
    register(workflow, execute) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const engine = this
      return Effect.suspend(() => {
        if (entities.has(workflow.name)) {
          return Effect.die(`Workflow ${workflow.name} already registered`)
        }
        return sharding.registerEntity(
          ensureEntity(workflow),
          Effect.gen(function*() {
            const address = yield* Entity.CurrentAddress
            const executionId = address.entityId
            return {
              run: (request: Entity.Request<any>) => {
                const instance = WorkflowInstance.initial(workflow, executionId)
                let payload = request.payload as any
                let parent: { workflowName: string; executionId: string } | undefined
                if (payload[payloadParentKey]) {
                  parent = payload[payloadParentKey]
                  payload = Record.remove(payload, payloadParentKey)
                }
                return execute(payload, executionId).pipe(
                  Effect.ensuring(Effect.suspend(() => {
                    if (!instance.suspended) {
                      return parent ? ensureSuccess(sendResumeParent(parent)) : Effect.void
                    }
                    return engine.deferredResult(InterruptSignal).pipe(
                      Effect.flatMap((maybeResult) => {
                        if (maybeResult === undefined) {
                          return Effect.void
                        }
                        instance.suspended = false
                        instance.interrupted = true
                        return Effect.flatMap(
                          Effect.ignore(clearClock({ workflow, executionId })),
                          () => Effect.interrupt
                        )
                      }),
                      Effect.orDie
                    )
                  })),
                  Workflow.intoResult,
                  Effect.provideService(WorkflowInstance, instance)
                ) as any
              },

              activity: Effect.fnUntraced(function*(request: Entity.Request<any>) {
                const payload = request.payload as any
                const activityId = `${executionId}/${payload.name}`
                let entry = activities.get(activityId)
                while (!entry) {
                  const latch = Effect.makeLatchUnsafe()
                  activityLatches.set(activityId, latch)
                  yield* latch.await
                  entry = activities.get(activityId)
                }
                const serviceMap = new Map(entry.services.mapUnsafe)
                serviceMap.set(Activity.CurrentAttempt.key, payload.attempt)
                serviceMap.set(
                  WorkflowInstance.key,
                  WorkflowInstance.initial(workflow, executionId)
                )
                return yield* entry.activity.executeEncoded.pipe(
                  Workflow.intoResult,
                  Effect.provideServices(ServiceMap.makeUnsafe(serviceMap)),
                  Effect.ensuring(Effect.sync(() => {
                    activities.delete(activityId)
                  }))
                )
              }, Rpc.fork),

              deferred: Effect.fnUntraced(function*(request: Entity.Request<any>) {
                const payload = request.payload as any
                yield* ensureSuccess(resume(workflow, executionId))
                return payload.exit
              }),

              resume: () => ensureSuccess(resume(workflow, executionId))
            }
          })
        ) as Effect.Effect<void>
      })
    },

    execute: ({ discard, executionId, parent, payload, workflow }) => {
      ensureEntity(workflow)
      return RcMap.get(clients, workflow.name).pipe(
        Effect.flatMap((make) =>
          make(executionId).run(
            parent ?
              {
                ...payload,
                [payloadParentKey]: { workflowName: parent.workflow.name, executionId: parent.executionId }
              } :
              payload,
            { discard }
          )
        ),
        Effect.orDie,
        Effect.scoped
      )
    },

    interrupt: Effect.fnUntraced(
      function*(this: WorkflowEngine["Service"], workflow, executionId) {
        const reply = yield* requestReply({
          workflow,
          entityType: `Workflow/${workflow.name}`,
          executionId,
          tag: "run",
          id: ""
        })

        const nonSuspendedReply = reply && (reply.exit._tag !== "Success" || reply.exit.value._tag !== "Suspended")
          ? reply
          : undefined
        if (nonSuspendedReply !== undefined) {
          return
        }
        yield* this.deferredDone({
          workflowName: workflow.name,
          executionId,
          deferredName: InterruptSignal.name,
          exit: Exit.void
        })
      },
      Effect.retry({
        while: (e) => e._tag === "PersistenceError",
        times: 3,
        schedule: Schedule.exponential(250)
      }),
      Effect.orDie,
      (effect, workflow, executionId) =>
        Effect.withSpan(effect, "WorkflowEngine.interrupt", {
          captureStackTrace: false,
          attributes: {
            name: workflow.name,
            executionId
          }
        })
    ),

    resume: (workflow, executionId) =>
      ensureSuccess(resume(workflow, executionId)).pipe(
        Effect.withSpan("WorkflowEngine.resume", {
          attributes: {
            name: workflow.name,
            executionId
          }
        }, { captureStackTrace: false })
      ),

    activityExecute: Effect.fnUntraced(
      function*({ activity, attempt }) {
        const services = yield* Effect.services<WorkflowInstance>()
        const instance = ServiceMap.get(services, WorkflowInstance)
        yield* Effect.annotateCurrentSpan("executionId", instance.executionId)
        const activityId = `${instance.executionId}/${activity.name}`
        activities.set(activityId, { activity, services })
        const latch = activityLatches.get(activityId)
        if (latch) {
          yield* latch.release
          activityLatches.delete(activityId)
        }
        const client = (yield* RcMap.get(clients, instance.workflow.name))(instance.executionId)
        while (true) {
          const result = yield* Effect.orDie(client.activity({ name: activity.name, attempt }))
          // If the activity has suspended and did not execute, we need to resume
          // it by resetting the attempt and re-executing.
          if (result._tag === "Suspended" && activities.has(activityId)) {
            yield* resetActivityAttempt({
              workflow: instance.workflow,
              executionId: instance.executionId,
              activity,
              attempt
            })
            continue
          }
          activities.delete(activityId)
          return result
        }
      },
      Effect.scoped,
      (effect, { activity, attempt }) =>
        Effect.withSpan(effect, "WorkflowEngine.activityExecute", {
          captureStackTrace: false,
          attributes: {
            name: activity.name,
            attempt
          }
        })
    ),

    deferredResult: (deferred) =>
      WorkflowInstance.asEffect().pipe(
        Effect.tap((instance) => Effect.annotateCurrentSpan("executionId", instance.executionId)),
        Effect.flatMap((instance) =>
          requestReply({
            workflow: instance.workflow,
            entityType: `Workflow/${instance.workflow.name}`,
            executionId: instance.executionId,
            tag: "deferred",
            id: deferred.name
          })
        ),
        Effect.map((reply) => {
          if (reply === undefined) {
            return undefined
          }
          const decoded = decodeDeferredWithExit(reply)
          return decoded.exit._tag === "Success"
            ? decoded.exit.value
            : decoded.exit
        }),
        Effect.retry({
          while: (e) => e._tag === "PersistenceError",
          times: 3,
          schedule: Schedule.exponential(250)
        }),
        Effect.orDie,
        Effect.withSpan("WorkflowEngine.deferredResult", {
          attributes: {
            name: deferred.name
          }
        }, { captureStackTrace: false })
      ),

    deferredDone: Effect.fnUntraced(
      function*({ deferredName, executionId, exit, workflowName }) {
        const client = yield* RcMap.get(clientsPartial, workflowName)
        return yield* Effect.orDie(
          client(executionId).deferred({
            name: deferredName,
            exit
          }, { discard: true })
        )
      },
      Effect.scoped,
      (effect, { deferredName, executionId }) =>
        Effect.withSpan(effect, "WorkflowEngine.deferredDone", {
          captureStackTrace: false,
          attributes: {
            name: deferredName,
            executionId
          }
        })
    ),

    scheduleClock(options) {
      const client = clockClient(options.executionId)
      return DateTime.now.pipe(
        Effect.flatMap((now) =>
          client.run({
            name: options.clock.name,
            workflowName: options.workflow.name,
            wakeUp: DateTime.addDuration(now, options.clock.duration)
          }, { discard: true })
        ),
        Effect.orDie
      )
    }
  })
})

const retryPolicy = Schedule.exponential(200, 1.5).pipe(
  Schedule.either(Schedule.spaced("1 minute"))
)

const ensureSuccess = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.sandbox,
    Effect.retry(retryPolicy),
    Effect.orDie
  )

const AnyOrVoid = Schema.Union([Schema.Undefined, Schema.Any])
const ExitUnknown = Schema.Exit(AnyOrVoid, AnyOrVoid, Schema.Any)

const ActivityRpc = Rpc.make("activity", {
  payload: {
    name: Schema.String,
    attempt: Schema.Number
  },
  primaryKey: ({ attempt, name }) => activityPrimaryKey(name, attempt),
  success: Workflow.Result({
    success: AnyOrVoid,
    error: AnyOrVoid
  })
}).annotate(ClusterSchema.Persisted, true)

const DeferredRpc = Rpc.make("deferred", {
  payload: {
    name: Schema.String,
    exit: ExitUnknown
  },
  primaryKey: ({ name }) => name,
  success: ExitUnknown
})
  .annotate(ClusterSchema.Persisted, true)
  .annotate(ClusterSchema.Uninterruptible, true)

const decodeDeferredWithExit = Schema.decodeSync(Serializer.json(Reply.WithExit.schema(DeferredRpc)))

const ResumeRpc = Rpc.make("resume")
  .annotate(ClusterSchema.Persisted, true)
  .annotate(ClusterSchema.Uninterruptible, true)

const payloadParentKey = "~effect/cluster/ClusterWorkflowEngine/payloadParentKey"

const makeWorkflowEntity = (workflow: Workflow.AnyWithProps) =>
  Entity.make(`Workflow/${workflow.name}`, [
    Rpc.make("run", {
      payload: {
        ...workflow.payloadSchema.fields,
        [payloadParentKey]: Schema.optional(Schema.Struct({
          workflowName: Schema.String,
          executionId: Schema.String
        }))
      },
      primaryKey: () => "",
      success: Workflow.Result({
        success: workflow.successSchema,
        error: workflow.errorSchema
      })
    })
      .annotate(ClusterSchema.Persisted, true)
      .annotate(ClusterSchema.Uninterruptible, true),

    DeferredRpc,
    ResumeRpc,
    ActivityRpc
  ]).annotateMerge(workflow.annotations)

const makePartialWorkflowEntity = (workflowName: string) =>
  Entity.make(`Workflow/${workflowName}`, [
    DeferredRpc,
    ResumeRpc,
    ActivityRpc
  ])

const activityPrimaryKey = (activity: string, attempt: number) => `${activity}/${attempt}`

class ClockPayload extends Schema.Class<ClockPayload>(`Workflow/DurableClock/Run`)({
  name: Schema.String,
  workflowName: Schema.String,
  wakeUp: Schema.DateTimeUtcFromMillis
}) {
  [PrimaryKey.symbol]() {
    return this.name
  }
  [DeliverAt.symbol]() {
    return this.wakeUp
  }
}

const ClockEntity = Entity.make("Workflow/-/DurableClock", [
  Rpc.make("run", { payload: ClockPayload })
    .annotate(ClusterSchema.Persisted, true)
    .annotate(ClusterSchema.Uninterruptible, true)
])

const ClockEntityLayer = ClockEntity.toLayer(Effect.gen(function*() {
  const engine = yield* WorkflowEngine
  const address = yield* Entity.CurrentAddress
  const executionId = address.entityId
  return {
    run(request) {
      const deferred = DurableClock.make({ name: request.payload.name, duration: Duration.zero }).deferred
      return ensureSuccess(engine.deferredDone({
        workflowName: request.payload.workflowName,
        executionId,
        deferredName: deferred.name,
        exit: Exit.void
      }))
    }
  }
}))

const InterruptSignal = DurableDeferred.make("Workflow/InterruptSignal")

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<
  WorkflowEngine,
  never,
  Sharding.Sharding | MessageStorage
> = ClockEntityLayer.pipe(
  Layer.provideMerge(Layer.effect(WorkflowEngine)(make))
)
