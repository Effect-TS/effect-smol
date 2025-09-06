/**
 * @sincle 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import type * as Effect from "../../Effect.ts"
import { constFalse, constTrue } from "../../Function.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Types from "../../types/Types.ts"
import type { AiError } from "./AiError.ts"

const TypeId = "~effect/ai/AiTool" as const

/**
 * A `AiTool` represents an action that a large language model can take within
 * your application. The results of a tool call can be returned back to the
 * large language model to be incorporated into its next response.
 *
 * @sincle 4.0.0
 * @category Models
 */
export interface AiTool<
  out Name extends string,
  out Parameters extends AnyStructSchema = Schema.Struct<{}>,
  out Success extends Schema.Top = Schema.Void,
  out Failure extends Schema.Top = Schema.Never,
  out Requirements = never
> extends Pipeable {
  readonly [TypeId]: {
    readonly _Requirements: Types.Covariant<Requirements>
  }

  /**
   * The name of the tool.
   */
  readonly name: Name

  /**
   * The optional description of the tool.
   */
  readonly description?: string | undefined

  /**
   * A key for the tool, used to identify the tool within a `ServiceMap`.
   */
  readonly key: string

  /**
   * A `Schema` representing the type of the parameters that a tool handler
   * must be called with.
   */
  readonly parametersSchema: Parameters

  /**
   * A `Schema` representing the type that a tool returns from its handler
   * if successful.
   */
  readonly successSchema: Success

  /**
   * A `Schema` representing the type that a tool returns from its handler
   * if it fails.
   */
  readonly failureSchema: Failure

  readonly annotations: ServiceMap.ServiceMap<never>

  /**
   * Adds a requirement on a particular service for the tool call to be able to
   * be executed.
   */
  addRequirement<Requirement>(): AiTool<Name, Parameters, Success, Failure, Requirements | Requirement>

  /**
   * Set the schema to use for tool handler success.
   */
  setSuccess<SuccessSchema extends Schema.Top>(schema: SuccessSchema): AiTool<
    Name,
    Parameters,
    SuccessSchema,
    Failure,
    Requirements
  >

  /**
   * Set the schema to use for tool handler failure.
   */
  setFailure<FailureSchema extends Schema.Top>(schema: FailureSchema): AiTool<
    Name,
    Parameters,
    Success,
    FailureSchema,
    Requirements
  >

  /**
   * Set the schema for the tool parameters.
   */
  setParameters<ParametersSchema extends Schema.Struct<any> | Schema.Struct.Fields>(
    schema: ParametersSchema
  ): AiTool<
    Name,
    ParametersSchema extends Schema.Struct<infer _> ? ParametersSchema
      : ParametersSchema extends Schema.Struct.Fields ? Schema.Struct<ParametersSchema>
      : never,
    Success,
    Failure,
    Requirements
  >

  /**
   * Add an annotation to the tool.
   */
  annotate<I, S>(key: ServiceMap.Key<I, S>, value: S): AiTool<
    Name,
    Parameters,
    Success,
    Failure,
    Requirements
  >

  /**
   * Add many annotations to the tool.
   */
  annotateMerge<I>(annotations: ServiceMap.ServiceMap<I>): AiTool<
    Name,
    Parameters,
    Success,
    Failure,
    Requirements
  >
}

/**
 * @sincle 4.0.0
 * @category Guards
 */
export const isAiTool = (u: unknown): u is AiTool<any, any, any, any, any> => Predicate.hasProperty(u, TypeId)

/**
 * @sincle 4.0.0
 * @category Models
 */
export interface Any extends AiTool<any, AnyStructSchema, Schema.Top, Schema.Top, any> {}

/**
 * Represents an `AiTool` that has been implemented within the application.
 *
 * @sincle 4.0.0
 * @category Models
 */
export interface Handler<Name extends string> {
  readonly _: unique symbol
  readonly name: Name
  readonly handler: (params: any) => Effect.Effect<any, any>
  readonly services: ServiceMap.ServiceMap<never>
}

/**
 * A utility type which returns the type of the `Effect` that will be used to
 * resolve a tool call.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type HandlerEffect<Tool extends Any> = [Tool] extends [
  AiTool<
    infer _Name,
    infer _Parameters,
    infer _Success,
    infer _Failure,
    infer _Requirements
  >
] ? Effect.Effect<
    _Success["Type"],
    _Failure["Type"] | AiError,
    _Parameters["EncodingServices"] | _Success["DecodingServices"] | _Failure["DecodingServices"] | _Requirements
  >
  : never

/**
 * Represents the result of calling the handler for a particular tool.
 *
 * @sincle 4.0.0
 * @category Models
 */
export interface HandlerResult<Tool extends Any> {
  /**
   * The result of executing the handler for a particular tool.
   */
  readonly result: Success<Tool>
  /**
   * The encoded result of executing the handler for a particular tool, which
   * is suitable for returning back to the large language model for
   * incorporation into further responses.
   */
  readonly encodedResult: unknown
}

/**
 * A utility mapped type which associates tool names with tools.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type ByName<Tools extends Any> = {
  readonly [Tool in Tools as Tool["name"]]: Tool
}

/**
 * A utility type to extract the `Name` type from an `AiTool`.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type Name<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Name :
  never

/**
 * A utility type to extract the type of the parameters which an `AiTool` must
 * be called with.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type Parameters<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Parameters["Type"] :
  never

/**
 * A utility type to extract the schema type of the parameters which an `AiTool`
 * must be called with.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type ParametersSchema<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Parameters :
  never

/**
 * A utility type to extract the type of the response that an `AiTool` returns
 * from its handler if successful.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type Success<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Success["Type"] :
  never

/**
 * A utility type to extract the schema type of the response that an `AiTool`
 * returns from its handler if successful.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type SuccessSchema<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Success :
  never

/**
 * A utility type to extract the type of the response that an `AiTool` returns
 * from its handler if it fails.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type Failure<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Failure["Type"] :
  never

/**
 * A utility type to extract the schema type of the response that an `AiTool`
 * returns from its handler if it fails.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type FailureSchema<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Failure :
  never

/**
 * A utility type to the `Context` type from an `AiTool`.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type Services<Tool> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? _Parameters["EncodingServices"] | _Success["DecodingServices"] | _Failure["DecodingServices"] | _Requirements :
  never

/**
 * @sincle 4.0.0
 * @category Utility Types
 */
export interface AnyStructSchema extends Schema.Top {
  readonly fields: Schema.Struct.Fields
}

/**
 * A utility type which returns the handler type for an `AiTool`.
 *
 * @sincle 4.0.0
 * @category Utility Types
 */
export type ToHandler<Tool extends Any> = Tool extends AiTool<
  infer _Name,
  infer _Parameters,
  infer _Success,
  infer _Failure,
  infer _Requirements
> ? Handler<_Name> :
  never

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  },
  addRequirement(this: Any) {
    return makeProto({ ...this })
  },
  setSuccess(this: Any, successSchema: Schema.Top) {
    return makeProto({
      ...this,
      successSchema
    })
  },
  setFailure(this: Any, failureSchema: Schema.Top) {
    return makeProto({
      ...this,
      failureSchema
    })
  },
  setParameters(this: Any, parametersSchema: Schema.Struct<any> | Schema.Struct.Fields) {
    return makeProto({
      ...this,
      parametersSchema: Schema.isSchema(parametersSchema)
        ? parametersSchema as any
        : Schema.Struct(parametersSchema as any)
    })
  },
  annotate<I, S>(this: Any, key: ServiceMap.Key<I, S>, value: S) {
    return makeProto({
      ...this,
      annotations: ServiceMap.add(this.annotations, key, value)
    })
  },
  annotateMerge<I>(this: Any, annotations: ServiceMap.ServiceMap<I>) {
    return makeProto({
      ...this,
      annotations: ServiceMap.merge(this.annotations, annotations)
    })
  }
}

const makeProto = <
  const Name extends string,
  Parameters extends AnyStructSchema,
  Success extends Schema.Top,
  Failure extends Schema.Top
>(options: {
  readonly name: Name
  readonly description?: string | undefined
  readonly parametersSchema: Parameters
  readonly successSchema: Success
  readonly failureSchema: Failure
  readonly annotations: ServiceMap.ServiceMap<never>
}): AiTool<Name, Parameters, Success> => {
  const self = Object.assign(Object.create(Proto), options)
  self.key = `effect/ai/AiTool/${options.name}`
  return self
}

const constEmptyStruct = Schema.Struct({})

/**
 * Constructs an `AiTool` from a name and, optionally, a specification for the
 * tool call's protocol.
 *
 * @sincle 4.0.0
 * @category constructors
 */
export const make = <
  const Name extends string,
  Parameters extends Schema.Struct.Fields = {},
  Success extends Schema.Top = Schema.Void,
  Failure extends Schema.Top = Schema.Never
>(name: Name, options?: {
  /**
   * An optional description of the tool.
   */
  readonly description?: string | undefined
  /**
   * A `Schema` representing the type of the parameters that a tool call
   * handler must be provided with.
   */
  readonly parameters?: Parameters
  /**
   * A `Schema` representing the type that a tool returns from its handler if
   * successful.
   */
  readonly success?: Success
  /**
   * A `Schema` representing the type that a tool returns from its handler if
   * it fails.
   */
  readonly failure?: Failure
}): AiTool<Name, Schema.Struct<Parameters>, Success, Failure> => {
  const successSchema = options?.success ?? Schema.Void
  const failureSchema = options?.failure ?? Schema.Never
  return makeProto({
    name,
    description: options?.description,
    parametersSchema: options?.parameters
      ? Schema.Struct(options?.parameters as any)
      : constEmptyStruct,
    successSchema,
    failureSchema,
    annotations: ServiceMap.empty()
  }) as any
}

/**
 * @sincle 4.0.0
 * @category Annotations
 */
export class Title extends ServiceMap.Key<Title, string>()("effect/ai/AiTool/Title") {}

/**
 * @sincle 4.0.0
 * @category Annotations
 */
export const Readonly = ServiceMap.Reference<boolean>("effect/ai/AiTool/Readonly", {
  defaultValue: constFalse
})

/**
 * @sincle 4.0.0
 * @category Annotations
 */
export const Destructive = ServiceMap.Reference<boolean>("effect/ai/AiTool/Destructive", {
  defaultValue: constTrue
})

/**
 * @sincle 4.0.0
 * @category Annotations
 */
export const Idempotent = ServiceMap.Reference<boolean>("effect/ai/AiTool/Idempotent", {
  defaultValue: constFalse
})

/**
 * @sincle 4.0.0
 * @category Annotations
 */
export const OpenWorld = ServiceMap.Reference<boolean>("effect/ai/AiTool/OpenWorld", {
  defaultValue: constTrue
})
