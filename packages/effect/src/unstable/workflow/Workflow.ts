/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Data from "../../data/Data.ts"
import * as Option from "../../data/Option.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import { constFalse, constTrue, dual, identity } from "../../Function.ts"
import * as Layer from "../../Layer.ts"
import type * as Schedule from "../../Schedule.ts"
import * as Issue from "../../schema/Issue.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Serializer from "../../schema/Serializer.ts"
import * as ToParser from "../../schema/ToParser.ts"
import * as Tranformation from "../../schema/Transformation.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { ExitEncoded } from "../rpc/RpcMessage.ts"
import { makeHashDigest } from "./internal/crypto.ts"
import type { WorkflowEngine, WorkflowInstance } from "./WorkflowEngine.ts"

const TypeId = "~effect/workflow/Workflow"

/**
 * @since 4.0.0
 * @category Models
 */
export interface Workflow<
  Name extends string,
  Payload extends AnyStructSchema,
  Success extends Schema.Top,
  Error extends Schema.Top
> {
  readonly [TypeId]: typeof TypeId
  readonly name: Name
  readonly payloadSchema: Payload
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly annotations: ServiceMap.ServiceMap<never>

  /**
   * Add an annotation to the workflow.
   */
  annotate<I, S>(key: ServiceMap.Key<I, S>, value: S): Workflow<
    Name,
    Payload,
    Success,
    Error
  >

  /**
   * Merge multiple annotations into the workflow.
   */
  annotateMerge<I>(annotations: ServiceMap.ServiceMap<I>): Workflow<
    Name,
    Payload,
    Success,
    Error
  >

  /**
   * Execute the workflow with the given payload.
   */
  readonly execute: <const Discard extends boolean = false>(
    payload: Payload["~type.make.in"],
    options?: {
      readonly discard?: Discard
    }
  ) => Effect.Effect<
    Discard extends true ? string : Success["Type"],
    Discard extends true ? never : Error["Type"],
    WorkflowEngine | Payload["EncodingServices"] | Success["DecodingServices"] | Error["DecodingServices"]
  >

  /**
   * Execute the workflow with the given payload.
   */
  readonly poll: (executionId: string) => Effect.Effect<
    Result<Success["Type"], Error["Type"]> | undefined,
    never,
    WorkflowEngine | Success["DecodingServices"] | Error["DecodingServices"]
  >

  /**
   * Interrupt a workflow execution for the given execution ID.
   */
  readonly interrupt: (executionId: string) => Effect.Effect<void, never, WorkflowEngine>

  /**
   * Manually resume a workflow execution for the given execution ID.
   */
  readonly resume: (executionId: string) => Effect.Effect<void, never, WorkflowEngine>

  /**
   * Create a layer that registers the workflow and provides an effect to
   * execute it.
   */
  readonly toLayer: <R>(
    execute: (
      payload: Payload["Type"],
      executionId: string
    ) => Effect.Effect<Success["Type"], Error["Type"], R>
  ) => Layer.Layer<
    never,
    never,
    | WorkflowEngine
    | Exclude<R, WorkflowEngine | WorkflowInstance | Execution<Name> | Scope.Scope>
    | Payload["DecodingServices"]
    | Payload["EncodingServices"]
    | Success["DecodingServices"]
    | Success["EncodingServices"]
    | Error["DecodingServices"]
    | Error["EncodingServices"]
  >

  /**
   * For the given payload, compute the deterministic execution ID.
   */
  readonly executionId: (payload: Payload["~type.make.in"]) => Effect.Effect<string>

  /**
   * Add compensation logic to an effect inside a Workflow. The compensation finalizer will be
   * called if the entire workflow fails, allowing you to perform cleanup or
   * other actions based on the success value and the cause of the workflow failure.
   *
   * NOTE: Compensation will not work for nested activities. Compensation
   * finalizers are only registered for top-level effects in the workflow.
   */
  readonly withCompensation: {
    <A, R2>(
      compensation: (value: A, cause: Cause.Cause<Error["Type"]>) => Effect.Effect<void, never, R2>
    ): <E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R | R2 | WorkflowInstance | Execution<Name> | Scope.Scope>
    <A, E, R, R2>(
      effect: Effect.Effect<A, E, R>,
      compensation: (value: A, cause: Cause.Cause<Error["Type"]>) => Effect.Effect<void, never, R2>
    ): Effect.Effect<A, E, R | R2 | WorkflowInstance | Execution<Name> | Scope.Scope>
  }
}

/**
 * @since 4.0.0
 */
export interface AnyStructSchema extends Schema.Top {
  readonly fields: Schema.Struct.Fields
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Execution<Name extends string> {
  readonly _: unique symbol
  readonly name: Name
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Any {
  readonly [TypeId]: typeof TypeId
  readonly name: string
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly executionId: (payload: any) => Effect.Effect<string>
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface AnyWithProps extends Any {
  readonly payloadSchema: AnyStructSchema
  readonly successSchema: Schema.Top
  readonly errorSchema: Schema.Top
  readonly execute: (payload: any, options?: { readonly discard?: boolean }) => Effect.Effect<any, any, any>
  readonly resume: (executionId: string) => Effect.Effect<void, never, WorkflowEngine>
}

/**
 * @since 4.0.0
 * @category Models
 */
export type PayloadSchema<W> = W extends Workflow<
  infer _Name,
  infer _Payload,
  infer _Success,
  infer _Error
> ? _Payload :
  never

/**
 * @since 4.0.0
 * @category Models
 */
export type RequirementsClient<Workflows extends Any> = Workflows extends Workflow<
  infer _Name,
  infer _Payload,
  infer _Success,
  infer _Error
> ? _Payload["EncodingServices"] | _Success["DecodingServices"] | _Error["DecodingServices"] :
  never

/**
 * @since 4.0.0
 * @category Models
 */
export type RequirementsHandler<Workflows extends Any> = Workflows extends Workflow<
  infer _Name,
  infer _Payload,
  infer _Success,
  infer _Error
> ?
    | _Payload["DecodingServices"]
    | _Payload["EncodingServices"]
    | _Success["DecodingServices"]
    | _Success["EncodingServices"]
    | _Error["DecodingServices"]
    | _Error["EncodingServices"] :
  never

const EngineTag = ServiceMap.Key<WorkflowEngine, WorkflowEngine["Service"]>(
  "effect/workflow/WorkflowEngine" satisfies typeof WorkflowEngine.key
)

const InstanceTag = ServiceMap.Key<WorkflowInstance, WorkflowInstance["Service"]>(
  "effect/workflow/WorkflowEngine/WorkflowInstance" satisfies typeof WorkflowInstance.key
)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <
  const Name extends string,
  Payload extends Schema.Struct.Fields | AnyStructSchema,
  Success extends Schema.Top = Schema.Void,
  Error extends Schema.Top = Schema.Never
>(
  options: {
    readonly name: Name
    readonly payload: Payload
    readonly idempotencyKey: (
      payload: Payload extends Schema.Struct.Fields ? Schema.Struct.Type<Payload> : Payload["Type"]
    ) => string
    readonly success?: Success
    readonly error?: Error
    readonly suspendedRetrySchedule?: Schedule.Schedule<any, unknown> | undefined
    readonly annotations?: ServiceMap.ServiceMap<never>
  }
): Workflow<Name, Payload extends Schema.Struct.Fields ? Schema.Struct<Payload> : Payload, Success, Error> => {
  const makeExecutionId = (payload: any) => makeHashDigest(`${options.name}-${options.idempotencyKey(payload)}`)
  const self: Workflow<Name, any, Success, Error> = {
    [TypeId]: TypeId,
    name: options.name,
    payloadSchema: Schema.isSchema(options.payload) ? options.payload : Schema.Struct(options.payload as any),
    successSchema: options.success ?? Schema.Void as any,
    errorSchema: options.error ?? Schema.Never as any,
    annotations: options.annotations ?? ServiceMap.empty(),
    annotate(tag, value) {
      return make({
        ...options,
        annotations: ServiceMap.add(self.annotations, tag, value)
      })
    },
    annotateMerge(context) {
      return make({
        ...options,
        annotations: ServiceMap.merge(self.annotations, context)
      })
    },
    execute: Effect.fnUntraced(
      function*(fields: any, opts) {
        const payload = self.payloadSchema.makeSync(fields)
        const engine = yield* EngineTag
        const executionId = yield* makeExecutionId(payload)
        yield* Effect.annotateCurrentSpan({ executionId })
        return yield* engine.execute(self, {
          executionId,
          payload,
          discard: opts?.discard,
          suspendedRetrySchedule: options.suspendedRetrySchedule
        })
      },
      Effect.withSpan(`${options.name}.execute`, {}, { captureStackTrace: false })
    ) as any,
    poll: Effect.fnUntraced(
      function*(executionId: string) {
        const engine = yield* EngineTag
        return yield* engine.poll(self, executionId)
      },
      (effect, executionId) =>
        Effect.withSpan(effect, `${options.name}.poll`, {
          captureStackTrace: false,
          attributes: { executionId }
        })
    ),
    interrupt: Effect.fnUntraced(
      function*(executionId: string) {
        const engine = yield* EngineTag
        yield* engine.interrupt(self, executionId)
      },
      (effect, executionId) =>
        Effect.withSpan(effect, `${options.name}.interrupt`, {
          captureStackTrace: false,
          attributes: { executionId }
        })
    ),
    resume: Effect.fnUntraced(
      function*(executionId: string) {
        const engine = yield* EngineTag
        yield* engine.resume(self, executionId)
      },
      (effect, executionId) =>
        Effect.withSpan(effect, `${options.name}.resume`, {
          captureStackTrace: false,
          attributes: { executionId }
        })
    ),
    toLayer: (execute) =>
      Layer.effectDiscard(Effect.gen(function*() {
        const engine = yield* EngineTag
        return yield* engine.register(self, execute)
      })),
    executionId: (payload) => makeExecutionId(self.payloadSchema.make(payload)),
    withCompensation
  }

  return self
}

const ResultTypeId = "~effect/workflow/Workflow/Result"

/**
 * @since 4.0.0
 * @category Result
 */
export const isResult = <A = unknown, E = unknown>(u: unknown): u is Result<A, E> =>
  Predicate.hasProperty(u, ResultTypeId)

/**
 * @since 4.0.0
 * @category Result
 */
export type Result<A, E> = Complete<A, E> | Suspended

/**
 * @since 4.0.0
 * @category Result
 */
export type ResultEncoded<A, E> = CompleteEncoded<A, E> | typeof Suspended.Encoded

/**
 * @since 4.0.0
 * @category Result
 */
export interface CompleteEncoded<A, E> {
  readonly _tag: "Complete"
  readonly exit: ExitEncoded<A, E>
}

/**
 * @since 4.0.0
 */
export interface CompleteSchema<Success extends Schema.Top, Error extends Schema.Top> extends
  Schema.declareConstructor<
    Complete<Success["Type"], Error["Type"]>,
    Complete<Success["Encoded"], Error["Encoded"]>,
    readonly [Schema.Exit<Success, Error, Schema.Defect>]
  >
{
  readonly "~rebuild.out": CompleteSchema<Success, Error>
}

/**
 * @since 4.0.0
 * @category Result
 */
export class Complete<A, E> extends Data.TaggedClass("Complete")<{
  readonly exit: Exit.Exit<A, E>
}> {
  /**
   * @since 4.0.0
   */
  readonly [ResultTypeId] = ResultTypeId

  /**
   * @since 4.0.0
   */
  static Schema<Success extends Schema.Top, Error extends Schema.Top>(options: {
    readonly success: Success
    readonly error: Error
  }): CompleteSchema<Success, Error> {
    return Schema.declareConstructor<
      Complete<Success["Type"], Error["Type"]>,
      Complete<Success["Encoded"], Error["Encoded"]>
    >()(
      [Schema.Exit(options.success, options.error, Schema.Defect)],
      ([exit]) => (input, ast, options) => {
        if (!(isResult(input) && input._tag === "Complete")) {
          return Effect.fail(new Issue.InvalidType(ast, Option.some(input)))
        }
        return Effect.mapBothEager(ToParser.decodeEffect(exit)(input.exit, options), {
          onSuccess: (exit) => new Complete({ exit }),
          onFailure: (issue) => new Issue.Composite(ast, Option.some(input), [new Issue.Pointer(["exit"], issue)])
        })
      },
      {
        title: "Complete",
        defaultJsonSerializer: ([exit]) =>
          Schema.link<Complete<Success["Encoded"], Error["Encoded"]>>()(
            Schema.Struct({
              _tag: Schema.Literal("Complete"),
              exit
            }),
            Tranformation.transform({
              decode: (encoded) => new Complete({ exit: encoded.exit }),
              encode: (result) => ({ _tag: "Complete", exit: result.exit } as const)
            })
          )
      }
    )
  }
}

/**
 * @since 4.0.0
 * @category Result
 */
export class Suspended extends Schema.Class<Suspended>("effect/workflow/Workflow/Suspended")({
  _tag: Schema.tag("Suspended"),
  cause: Schema.optional(Schema.Cause(Schema.Never, Schema.Defect))
}) {
  /**
   * @since 4.0.0
   */
  readonly [ResultTypeId] = ResultTypeId
}

/**
 * @since 4.0.0
 * @category Result
 */
export const Result = <Success extends Schema.Top, Error extends Schema.Top>(
  options: {
    readonly success: Success
    readonly error: Error
  }
) => Schema.Union([Complete.Schema(options), Suspended])

const AnyOrVoid = Schema.Union([Schema.Any, Schema.Void])

/**
 * @since 4.0.0
 * @category Result
 */
export const ResultEncoded: Schema.Codec<ResultEncoded<any, any>> = Schema.encodedCodec(Serializer.json(Result({
  success: AnyOrVoid,
  error: AnyOrVoid
}))) as any

/**
 * @since 4.0.0
 * @category Result
 */
export const intoResult = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<Result<A, E>, never, Exclude<R, Scope.Scope> | WorkflowInstance> =>
  Effect.servicesWith((services: ServiceMap.ServiceMap<WorkflowInstance>) => {
    const instance = ServiceMap.get(services, InstanceTag)
    const captureDefects = ServiceMap.get(instance.workflow.annotations, CaptureDefects)
    const suspendOnFailure = ServiceMap.get(instance.workflow.annotations, SuspendOnFailure)
    return Effect.uninterruptibleMask((restore) =>
      restore(effect).pipe(
        suspendOnFailure ?
          Effect.catchCause((cause) => {
            instance.suspended = true
            if (!Cause.isInterruptedOnly(cause)) {
              instance.cause = Cause.die(Cause.squash(cause))
            }
            return Effect.interrupt
          }) :
          identity,
        Effect.scoped,
        Effect.matchCauseEffect({
          onSuccess: (value) => Effect.succeed(new Complete({ exit: Exit.succeed(value) })),
          onFailure: (cause): Effect.Effect<Result<A, E>> =>
            instance.suspended
              ? Effect.succeed(new Suspended({ cause: instance.cause }))
              : (!instance.interrupted && Cause.isInterruptedOnly(cause)) || (!captureDefects && Cause.hasDie(cause))
              ? Effect.failCause(cause as Cause.Cause<never>)
              : Effect.succeed(new Complete({ exit: Exit.failCause(cause) }))
        })
      )
    )
  })

/**
 * @since 4.0.0
 * @category Result
 */
export const wrapActivityResult = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  isSuspend: (value: A) => boolean
): Effect.Effect<A, E, R | WorkflowInstance> =>
  Effect.servicesWith((services: ServiceMap.ServiceMap<WorkflowInstance>) => {
    const instance = ServiceMap.get(services, InstanceTag)
    const state = instance.activityState
    if (instance.suspended) {
      return state.count > 0 ?
        state.latch.await.pipe(
          Effect.andThen(Effect.yieldNow),
          Effect.andThen(Effect.interrupt)
        ) :
        Effect.interrupt
    }
    if (state.count === 0) state.latch.closeUnsafe()
    state.count++
    return Effect.onExit(effect, (exit) => {
      state.count--
      const isSuspended = Exit.isSuccess(exit) && isSuspend(exit.value)
      if (Exit.isSuccess(exit) && isResult(exit.value) && exit.value._tag === "Suspended" && exit.value.cause) {
        instance.cause = instance.cause ? Cause.merge(instance.cause, exit.value.cause) : exit.value.cause
      }
      return state.count === 0 ? state.latch.open : isSuspended ? state.latch.await : Effect.void
    })
  })

/**
 * Add compensation logic to an effect inside a Workflow. The compensation finalizer will be
 * called if the entire workflow fails, allowing you to perform cleanup or
 * other actions based on the success value and the cause of the workflow failure.
 *
 * NOTE: Compensation will not work for nested activities. Compensation
 * finalizers are only registered for top-level effects in the workflow.
 *
 * @since 4.0.0
 * @category Compensation
 */
export const withCompensation: {
  <A, R2>(
    compensation: (value: A, cause: Cause.Cause<unknown>) => Effect.Effect<void, never, R2>
  ): <E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R | R2 | WorkflowInstance | Scope.Scope>
  <A, E, R, R2>(
    effect: Effect.Effect<A, E, R>,
    compensation: (value: A, cause: Cause.Cause<unknown>) => Effect.Effect<void, never, R2>
  ): Effect.Effect<A, E, R | R2 | WorkflowInstance | Scope.Scope>
} = dual(2, <A, E, R, R2>(
  effect: Effect.Effect<A, E, R>,
  compensation: (value: A, cause: Cause.Cause<unknown>) => Effect.Effect<void, never, R2>
): Effect.Effect<A, E, R | R2 | WorkflowInstance | Scope.Scope> =>
  Effect.uninterruptibleMask((restore) =>
    Effect.tap(
      restore(effect),
      (value) =>
        Effect.servicesWith((services: ServiceMap.ServiceMap<WorkflowInstance>) =>
          Effect.addFinalizer((exit) =>
            Exit.isSuccess(exit) || ServiceMap.get(services, InstanceTag).suspended
              ? Effect.void
              : compensation(value, exit.cause)
          )
        )
    )
  ))

/**
 * If you set this annotation to `true` for a workflow, it will capture defects
 * and include them in the result of the workflow or it's activities.
 *
 * By default, this is set to `true`, meaning that defects will be captured.
 *
 * @since 4.0.0
 * @category Annotations
 */
export const CaptureDefects = ServiceMap.Reference<boolean>("effect/workflow/Workflow/CaptureDefects", {
  defaultValue: constTrue
})

/**
 * If you set this annotation to `true` for a workflow, it will suspend if it
 * encounters any kind of error.
 *
 * You can then manually resume the workflow later with
 * `Workflow.resume(executionId)`.
 *
 * @since 4.0.0
 * @category Annotations
 */
export const SuspendOnFailure = ServiceMap.Reference<boolean>("effect/workflow/Workflow/SuspendOnFailure", {
  defaultValue: constFalse
})
