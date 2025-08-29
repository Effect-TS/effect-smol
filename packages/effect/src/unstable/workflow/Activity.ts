/**
 * @since 4.0.0
 */
import type { NonEmptyReadonlyArray } from "../../collections/Array.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import { dual } from "../../Function.ts"
import { PipeInspectableProto, YieldableProto } from "../../internal/core.ts"
import { Serializer } from "../../schema/index.ts"
import * as Schema from "../../schema/Schema.ts"
import type { Scope } from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as DurableDeferred from "./DurableDeferred.ts"
import { makeHashDigest } from "./internal/crypto.ts"
import * as Workflow from "./Workflow.ts"
import type { WorkflowEngine, WorkflowInstance } from "./WorkflowEngine.ts"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/workflow/Activity"

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = "~effect/workflow/Activity"

/**
 * @since 4.0.0
 * @category Models
 */
export interface Activity<
  Success extends Schema.Top = Schema.Void,
  Error extends Schema.Top = Schema.Never,
  R = never
> extends
  Effect.Yieldable<
    Activity<Success, Error, R>,
    Success["Type"],
    Error["Type"],
    Success["DecodingServices"] | Error["DecodingServices"] | R | WorkflowEngine | WorkflowInstance
  >
{
  readonly [TypeId]: TypeId
  readonly name: string
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly exitSchema: Schema.Exit<Success, Error, Schema.Defect>
  readonly execute: Effect.Effect<
    Success["Type"],
    Error["Type"],
    | Success["DecodingServices"]
    | Success["EncodingServices"]
    | Error["DecodingServices"]
    | Error["EncodingServices"]
    | R
    | Scope
    | WorkflowEngine
    | WorkflowInstance
  >
  readonly executeEncoded: Effect.Effect<
    unknown,
    unknown,
    | Success["DecodingServices"]
    | Success["EncodingServices"]
    | Error["DecodingServices"]
    | Error["EncodingServices"]
    | R
    | Scope
    | WorkflowEngine
    | WorkflowInstance
  >
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Any {
  readonly [TypeId]: TypeId
  readonly name: string
  readonly executeEncoded: Effect.Effect<any, any, any>
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface AnyWithProps {
  readonly [TypeId]: TypeId
  readonly name: string
  readonly successSchema: Schema.Top
  readonly errorSchema: Schema.Top
  readonly executeEncoded: Effect.Effect<any, any, any>
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <
  R,
  Success extends Schema.Top = Schema.Void,
  Error extends Schema.Top = Schema.Never
>(options: {
  readonly name: string
  readonly success?: Success | undefined
  readonly error?: Error | undefined
  readonly execute: Effect.Effect<Success["Type"], Error["Type"], R>
}): Activity<Success, Error, Exclude<R, WorkflowInstance | WorkflowEngine | Scope>> => {
  const successSchema = options.success ?? Schema.Void as any as Success
  const errorSchema = options.error ?? Schema.Never as any as Error
  const successSchemaJson = Serializer.json(successSchema)
  const errorSchemaJson = Serializer.json(errorSchema)
  // eslint-disable-next-line prefer-const
  let execute!: Effect.Effect<Success["Type"], Error["Type"], any>
  const self: Activity<Success, Error, Exclude<R, WorkflowInstance | WorkflowEngine>> = {
    ...PipeInspectableProto,
    ...YieldableProto,
    [TypeId]: TypeId,
    name: options.name,
    successSchema,
    errorSchema,
    exitSchema: Schema.Exit(successSchemaJson, errorSchemaJson, Schema.Defect),
    execute: options.execute,
    executeEncoded: Effect.matchEffect(options.execute, {
      onFailure: (error) => Effect.flatMap(Effect.orDie(Schema.encodeEffect(errorSchemaJson)(error)), Effect.fail),
      onSuccess: (value) => Effect.orDie(Schema.encodeEffect(successSchemaJson)(value))
    }),
    asEffect() {
      return execute
    }
  } as any
  execute = makeExecute(self)
  return self
}

/**
 * @since 4.0.0
 * @category Error handling
 */
export const retry: typeof Effect.retry = dual(
  2,
  (effect: Effect.Effect<any, any, any>, options: {}) =>
    Effect.suspend(() => {
      let attempt = 1
      return Effect.suspend(() => Effect.provideService(effect, CurrentAttempt, attempt++)).pipe(
        Effect.retry(options)
      )
    })
)

/**
 * @since 4.0.0
 * @category Attempts
 */
export const CurrentAttempt = ServiceMap.Reference<number>("effect/workflow/Activity/CurrentAttempt", {
  defaultValue: () => 1
})

/**
 * @since 4.0.0
 * @category Execution ID
 */
export const executionIdWithAttempt: Effect.Effect<
  string,
  never,
  WorkflowInstance
> = Effect.gen(function*() {
  const instance = yield* InstanceTag
  const attempt = yield* CurrentAttempt
  return yield* makeHashDigest(`${instance.executionId}-${attempt}`)
})

/**
 * @since 4.0.0
 * @category Racing
 */
export const raceAll = <const Activities extends NonEmptyReadonlyArray<Any>>(
  name: string,
  activities: Activities
): Effect.Effect<
  (Activities[number] extends Activity<infer _A, infer _E, infer _R> ? _A["Type"] : never),
  (Activities[number] extends Activity<infer _A, infer _E, infer _R> ? _E["Type"] : never),
  | (Activities[number] extends Activity<infer Success, infer Error, infer R>
    ? Success["DecodingServices"] | Error["DecodingServices"] | R
    : never)
  | WorkflowEngine
  | WorkflowInstance
> =>
  DurableDeferred.raceAll({
    name: `Activity/${name}`,
    success: Schema.Union(
      activities.map((activity) => (activity as any).successSchema)
    ),
    error: Schema.Union(
      activities.map((activity) => (activity as any).errorSchema)
    ),
    effects: activities.map((activity) => (activity as any).asEffect()) as any
  }) as any

// -----------------------------------------------------------------------------
// internal
// -----------------------------------------------------------------------------

const EngineTag = ServiceMap.Key<WorkflowEngine, WorkflowEngine["Service"]>(
  "effect/workflow/WorkflowEngine" satisfies typeof WorkflowEngine.key
)
const InstanceTag = ServiceMap.Key<WorkflowInstance, WorkflowInstance["Service"]>(
  "effect/workflow/WorkflowEngine/WorkflowInstance" satisfies typeof WorkflowInstance.key
)

const makeExecute = Effect.fnUntraced(function*<
  R,
  Success extends Schema.Top = Schema.Void,
  Error extends Schema.Top = Schema.Never
>(activity: Activity<Success, Error, R>) {
  const engine = yield* EngineTag
  const instance = yield* InstanceTag
  const attempt = yield* CurrentAttempt
  const result = yield* Workflow.wrapActivityResult(
    engine.activityExecute({
      activity,
      attempt
    }),
    (_) => _._tag === "Suspended"
  )
  if (result._tag === "Suspended") {
    instance.suspended = true
    return yield* Effect.interrupt
  }
  const exit = yield* Effect.orDie(
    Schema.decodeEffect(activity.exitSchema)(toJsonExit(result.exit))
  )
  return yield* exit
})

const toJsonExit = Exit.map((value: any) => value === undefined ? null : value)
