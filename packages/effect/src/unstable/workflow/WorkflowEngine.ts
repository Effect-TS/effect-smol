/**
 * @since 4.0.0
 */
import type * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Option from "../../Option.ts"
import * as Schedule from "../../Schedule.ts"
import * as Schema from "../../Schema.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Activity from "./Activity.ts"
import type { DurableClock } from "./DurableClock.ts"
import type * as DurableDeferred from "./DurableDeferred.ts"
import * as Workflow from "./Workflow.ts"

/**
 * @since 4.0.0
 * @category Services
 */
export class WorkflowEngine extends ServiceMap.Service<
  WorkflowEngine,
  {
    /**
     * Register a workflow with the engine.
     */
    readonly register: <
      Name extends string,
      Payload extends Workflow.AnyStructSchema,
      Success extends Schema.Top,
      Error extends Schema.Top,
      R
    >(
      workflow: Workflow.Workflow<Name, Payload, Success, Error>,
      execute: (
        payload: Payload["Type"],
        executionId: string
      ) => Effect.Effect<Success["Type"], Error["Type"], R>
    ) => Effect.Effect<
      void,
      never,
      | Scope.Scope
      | Exclude<
        R,
        | WorkflowEngine
        | WorkflowInstance
        | Workflow.Execution<Name>
        | Scope.Scope
      >
      | Payload["DecodingServices"]
      | Payload["EncodingServices"]
      | Success["DecodingServices"]
      | Success["EncodingServices"]
      | Error["DecodingServices"]
      | Error["EncodingServices"]
    >

    /**
     * Execute a registered workflow.
     */
    readonly execute: <
      Name extends string,
      Payload extends Workflow.AnyStructSchema,
      Success extends Schema.Top,
      Error extends Schema.Top,
      const Discard extends boolean = false
    >(
      workflow: Workflow.Workflow<Name, Payload, Success, Error>,
      options: {
        readonly executionId: string
        readonly payload: Payload["Type"]
        readonly discard?: Discard | undefined
        readonly suspendedRetrySchedule?:
          | Schedule.Schedule<any, unknown>
          | undefined
      }
    ) => Effect.Effect<
      Discard extends true ? string : Success["Type"],
      Error["Type"],
      | Payload["EncodingServices"]
      | Success["DecodingServices"]
      | Error["DecodingServices"]
    >

    /**
     * Execute a registered workflow.
     */
    readonly poll: <
      Name extends string,
      Payload extends Workflow.AnyStructSchema,
      Success extends Schema.Top,
      Error extends Schema.Top
    >(
      workflow: Workflow.Workflow<Name, Payload, Success, Error>,
      executionId: string
    ) => Effect.Effect<
      Workflow.Result<Success["Type"], Error["Type"]> | undefined,
      never,
      Success["DecodingServices"] | Error["DecodingServices"]
    >

    /**
     * Interrupt a registered workflow.
     */
    readonly interrupt: (
      workflow: Workflow.Any,
      executionId: string
    ) => Effect.Effect<void>

    /**
     * Resume a registered workflow.
     */
    readonly resume: (
      workflow: Workflow.Any,
      executionId: string
    ) => Effect.Effect<void>

    /**
     * Execute an activity from a workflow.
     */
    readonly activityExecute: <
      Success extends Schema.Top,
      Error extends Schema.Top,
      R
    >(
      activity: Activity.Activity<Success, Error, R>,
      attempt: number
    ) => Effect.Effect<
      Workflow.Result<Success["Type"], Error["Type"]>,
      never,
      | Success["DecodingServices"]
      | Error["DecodingServices"]
      | R
      | WorkflowInstance
    >

    /**
     * Try to retrieve the result of an DurableDeferred
     */
    readonly deferredResult: <
      Success extends Schema.Top,
      Error extends Schema.Top
    >(
      deferred: DurableDeferred.DurableDeferred<Success, Error>
    ) => Effect.Effect<
      Exit.Exit<Success["Type"], Error["Type"]> | undefined,
      never,
      WorkflowInstance
    >

    /**
     * Set the result of a DurableDeferred, and then resume any waiting
     * workflows.
     */
    readonly deferredDone: <
      Success extends Schema.Top,
      Error extends Schema.Top
    >(
      deferred: DurableDeferred.DurableDeferred<Success, Error>,
      options: {
        readonly workflowName: string
        readonly executionId: string
        readonly deferredName: string
        readonly exit: Exit.Exit<Success["Type"], Error["Type"]>
      }
    ) => Effect.Effect<
      void,
      never,
      Success["EncodingServices"] | Error["EncodingServices"]
    >

    /**
     * Schedule a wake up for a DurableClock
     */
    readonly scheduleClock: (
      workflow: Workflow.Any,
      options: {
        readonly executionId: string
        readonly clock: DurableClock
      }
    ) => Effect.Effect<void>
  }
>()("effect/workflow/WorkflowEngine") {}

/**
 * @since 4.0.0
 * @category Services
 */
export class WorkflowInstance extends ServiceMap.Service<
  WorkflowInstance,
  {
    /**
     * The workflow execution ID.
     */
    readonly executionId: string

    /**
     * The workflow definition.
     */
    readonly workflow: Workflow.Any

    /**
     * A scope that represents the lifetime of the workflow.
     *
     * It is only closed when the workflow is completed.
     */
    readonly scope: Scope.Closeable

    /**
     * Whether the workflow has requested to be suspended.
     */
    suspended: boolean

    /**
     * Whether the workflow has requested to be interrupted.
     */
    interrupted: boolean

    /**
     * When SuspendOnFailure is triggered, the cause of the failure is stored
     * here.
     */
    cause: Cause.Cause<never> | undefined

    readonly activityState: {
      count: number
      readonly latch: Effect.Latch
    }
  }
>()("effect/workflow/WorkflowEngine/WorkflowInstance") {
  static initial(
    workflow: Workflow.Any,
    executionId: string
  ): WorkflowInstance["Service"] {
    return WorkflowInstance.of({
      executionId,
      workflow,
      scope: Scope.makeUnsafe(),
      suspended: false,
      interrupted: false,
      cause: undefined,
      activityState: {
        count: 0,
        latch: Effect.makeLatchUnsafe()
      }
    })
  }
}

/**
 * @since 4.0.0
 * @category Encoded
 */
export interface Encoded {
  readonly register: (
    workflow: Workflow.Any,
    execute: (
      payload: object,
      executionId: string
    ) => Effect.Effect<unknown, unknown, WorkflowInstance | WorkflowEngine>
  ) => Effect.Effect<void, never, Scope.Scope>
  readonly execute: <const Discard extends boolean>(
    workflow: Workflow.Any,
    options: {
      readonly executionId: string
      readonly payload: object
      readonly discard: Discard
      readonly parent?: WorkflowInstance["Service"] | undefined
    }
  ) => Effect.Effect<
    Discard extends true ? void : Workflow.Result<unknown, unknown>
  >
  readonly poll: (
    workflow: Workflow.Any,
    executionId: string
  ) => Effect.Effect<Workflow.Result<unknown, unknown> | undefined>
  readonly interrupt: (
    workflow: Workflow.Any,
    executionId: string
  ) => Effect.Effect<void>
  readonly resume: (
    workflow: Workflow.Any,
    executionId: string
  ) => Effect.Effect<void>
  readonly activityExecute: (
    activity: Activity.Any,
    attempt: number
  ) => Effect.Effect<
    Workflow.Result<unknown, unknown>,
    never,
    WorkflowInstance
  >
  readonly deferredResult: (
    deferred: DurableDeferred.Any
  ) => Effect.Effect<
    Exit.Exit<unknown, unknown> | undefined,
    never,
    WorkflowInstance
  >
  readonly deferredDone: (options: {
    readonly workflowName: string
    readonly executionId: string
    readonly deferredName: string
    readonly exit: Exit.Exit<unknown, unknown>
  }) => Effect.Effect<void>
  readonly scheduleClock: (
    workflow: Workflow.Any,
    options: {
      readonly executionId: string
      readonly clock: DurableClock
    }
  ) => Effect.Effect<void>
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const makeUnsafe = (options: Encoded): WorkflowEngine["Service"] =>
  WorkflowEngine.of({
    register: Effect.fnUntraced(function*(workflow, execute) {
      const services = yield* Effect.services<WorkflowEngine>()
      yield* options.register(workflow, (payload, executionId) =>
        Effect.suspend(() =>
          execute(payload, executionId)
        ).pipe(
          Effect.updateServices(
            (input) => ServiceMap.merge(services, input) as ServiceMap.ServiceMap<any>
          )
        ))
    }),
    execute: Effect.fnUntraced(function*<
      Name extends string,
      Payload extends Workflow.AnyStructSchema,
      Success extends Schema.Top,
      Error extends Schema.Top,
      const Discard extends boolean = false
    >(
      self: Workflow.Workflow<Name, Payload, Success, Error>,
      opts: {
        readonly executionId: string
        readonly payload: Payload["Type"]
        readonly discard?: Discard | undefined
        readonly suspendedRetrySchedule?:
          | Schedule.Schedule<any, unknown>
          | undefined
      }
    ) {
      const payload = opts.payload
      const executionId = opts.executionId
      const suspendedRetrySchedule = opts.suspendedRetrySchedule ?? defaultRetrySchedule
      yield* Effect.annotateCurrentSpan({ executionId })
      let result: Workflow.Result<Success["Type"], Error["Type"]> | undefined

      // link interruption with parent workflow
      const parentInstance = yield* Effect.serviceOption(WorkflowInstance)
      if (Option.isSome(parentInstance)) {
        const instance = parentInstance.value
        yield* Effect.addFinalizer(() => {
          if (!instance.interrupted || result?._tag === "Complete") {
            return Effect.void
          }
          return options.interrupt(self, executionId)
        })
      }

      if (opts.discard) {
        yield* options.execute(self, {
          executionId,
          payload: payload as object,
          discard: true
        })
        return executionId
      }

      const run = options.execute(self, {
        executionId,
        payload: payload as object,
        discard: false,
        parent: Option.getOrUndefined(parentInstance)
      })
      if (Option.isSome(parentInstance)) {
        result = yield* Workflow.wrapActivityResult(
          run,
          (result) => result._tag === "Suspended"
        )
        if (result._tag === "Suspended") {
          return yield* Workflow.suspend(parentInstance.value)
        }
        return yield* result.exit
      }

      let sleep: Effect.Effect<any> | undefined
      while (true) {
        result = yield* run
        if (result._tag === "Complete") {
          return yield* result.exit as Exit.Exit<any>
        }
        sleep ??= (yield* Schedule.toStepWithSleep(suspendedRetrySchedule))(
          void 0
        ).pipe(
          Effect.catch(() =>
            Effect.die(
              `${self.name}.execute: suspendedRetrySchedule exhausted`
            )
          )
        )
        yield* sleep
      }
    }),
    poll: options.poll,
    interrupt: options.interrupt,
    resume: options.resume,
    activityExecute: Effect.fnUntraced(function*<
      Success extends Schema.Top,
      Error extends Schema.Top,
      R
    >(activity: Activity.Activity<Success, Error, R>, attempt: number) {
      const result = yield* options.activityExecute(activity, attempt)
      if (result._tag === "Suspended") {
        return result
      }
      const exit = yield* Effect.orDie(
        Schema.decodeEffect(activity.exitSchema)(toJsonExit(result.exit))
      )
      return new Workflow.Complete({ exit })
    }),
    deferredResult: Effect.fnUntraced(
      function*<Success extends Schema.Top, Error extends Schema.Top>(
        deferred: DurableDeferred.DurableDeferred<Success, Error>
      ) {
        const instance = yield* WorkflowInstance
        yield* Effect.annotateCurrentSpan({
          executionId: instance.executionId
        })
        const exit = yield* options.deferredResult(deferred)
        if (exit === undefined) {
          return exit
        }
        return yield* Effect.orDie(
          Schema.decodeEffect(deferred.exitSchema)(toJsonExit(exit))
        ) as Effect.Effect<Exit.Exit<Success["Type"], Error["Type"]>>
      },
      Effect.withSpan(
        "WorkflowEngine.deferredResult",
        (deferred) => ({
          attributes: { name: deferred.name }
        }),
        { captureStackTrace: false }
      )
    ),
    deferredDone: Effect.fnUntraced(
      function*<Success extends Schema.Top, Error extends Schema.Top>(
        deferred: DurableDeferred.DurableDeferred<Success, Error>,
        opts: {
          readonly workflowName: string
          readonly executionId: string
          readonly deferredName: string
          readonly exit: Exit.Exit<Success["Type"], Error["Type"]>
        }
      ) {
        return yield* options.deferredDone({
          workflowName: opts.workflowName,
          executionId: opts.executionId,
          deferredName: opts.deferredName,
          exit: yield* Schema.encodeEffect(deferred.exitSchema)(
            opts.exit
          ) as Effect.Effect<Exit.Exit<unknown, unknown>>
        })
      },
      Effect.withSpan(
        "WorkflowEngine.deferredDone",
        (_, { deferredName, executionId }) => ({
          attributes: { name: deferredName, executionId }
        }),
        { captureStackTrace: false }
      )
    ),
    scheduleClock: (workflow, opts) =>
      options.scheduleClock(workflow, opts).pipe(
        Effect.withSpan(
          "WorkflowEngine.scheduleClock",
          {
            attributes: {
              executionId: opts.executionId,
              name: opts.clock.name
            }
          },
          {
            captureStackTrace: false
          }
        )
      )
  })

const defaultRetrySchedule = Schedule.exponential(200, 1.5).pipe(
  Schedule.either(Schedule.spaced(30000))
)

const toJsonExit = Exit.map((value: any) => value ?? null)
