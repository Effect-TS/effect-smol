/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import type * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Duration from "../../time/Duration.ts"
import * as DurableDeferred from "./DurableDeferred.ts"
import type { WorkflowEngine, WorkflowInstance } from "./WorkflowEngine.ts"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/workflow/DurableClock"

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = "~effect/workflow/DurableClock"

/**
 * @since 4.0.0
 * @category Models
 */
export interface DurableClock {
  readonly [TypeId]: TypeId
  readonly name: string
  readonly duration: Duration.Duration
  readonly deferred: DurableDeferred.DurableDeferred<typeof Schema.Void>
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = (options: {
  readonly name: string
  readonly duration: Duration.DurationInput
}): DurableClock => ({
  [TypeId]: TypeId,
  name: options.name,
  duration: Duration.decode(options.duration),
  deferred: DurableDeferred.make(`DurableClock/${options.name}`)
})

const EngineTag = ServiceMap.Key<WorkflowEngine, WorkflowEngine["Service"]>(
  "effect/workflow/WorkflowEngine" satisfies typeof WorkflowEngine.key
)

const InstanceTag = ServiceMap.Key<WorkflowInstance, WorkflowInstance["Service"]>(
  "effect/workflow/WorkflowEngine/WorkflowInstance" satisfies typeof WorkflowInstance.key
)

/**
 * @since 4.0.0
 * @category Sleeping
 */
export const sleep: (
  options: {
    readonly name: string
    readonly duration: Duration.DurationInput
  }
) => Effect.Effect<
  void,
  never,
  WorkflowEngine | WorkflowInstance
> = Effect.fnUntraced(function*(options: {
  readonly name: string
  readonly duration: Duration.DurationInput
}) {
  const engine = yield* EngineTag
  const instance = yield* InstanceTag
  const clock = make(options)
  yield* engine.scheduleClock({
    workflow: instance.workflow,
    executionId: instance.executionId,
    clock
  })
  yield* DurableDeferred.await(clock.deferred)
})
