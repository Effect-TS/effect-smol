/**
 * @since 4.0.0
 */
import type * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import type * as Exit from "../../Exit.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Activity from "./Activity.ts"
import type { DurableClock } from "./DurableClock.ts"
import type * as DurableDeferred from "./DurableDeferred.ts"
import type * as Workflow from "./Workflow.ts"

/**
 * @since 4.0.0
 * @category Services
 */
export class WorkflowEngine extends ServiceMap.Key<
  WorkflowEngine,
  {
    /**
     * Register a workflow with the engine.
     */
    readonly register: (
      workflow: Workflow.Any,
      execute: (
        payload: object,
        executionId: string
      ) => Effect.Effect<unknown, unknown, WorkflowInstance | WorkflowEngine>
    ) => Effect.Effect<void>

    /**
     * Execute a registered workflow.
     */
    readonly execute: <const Discard extends boolean>(
      options: {
        readonly workflow: Workflow.Any
        readonly executionId: string
        readonly payload: object
        readonly discard: Discard
        readonly parent?: WorkflowInstance["Service"] | undefined
      }
    ) => Effect.Effect<Discard extends true ? void : Workflow.Result<unknown, unknown>>

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
    readonly activityExecute: (
      options: {
        readonly activity: Activity.Any
        readonly attempt: number
      }
    ) => Effect.Effect<Workflow.Result<unknown, unknown>, never, WorkflowInstance>

    /**
     * Try to retrieve the result of an DurableDeferred
     */
    readonly deferredResult: (
      deferred: DurableDeferred.Any
    ) => Effect.Effect<Exit.Exit<unknown, unknown> | undefined, never, WorkflowInstance>

    /**
     * Set the result of a DurableDeferred, and then resume any waiting
     * workflows.
     */
    readonly deferredDone: (
      options: {
        readonly workflowName: string
        readonly executionId: string
        readonly deferredName: string
        readonly exit: Exit.Exit<unknown, unknown>
      }
    ) => Effect.Effect<void>

    /**
     * Schedule a wake up for a DurableClock
     */
    readonly scheduleClock: (options: {
      readonly workflow: Workflow.Any
      readonly executionId: string
      readonly clock: DurableClock
    }) => Effect.Effect<void>
  }
>()("effect/workflow/WorkflowEngine") {}

/**
 * @since 4.0.0
 * @category Services
 */
export class WorkflowInstance extends ServiceMap.Key<
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
  static initial(workflow: Workflow.Any, executionId: string): WorkflowInstance["Service"] {
    return WorkflowInstance.of({
      executionId,
      workflow,
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
